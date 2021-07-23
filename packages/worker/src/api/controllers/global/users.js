const {
  generateGlobalUserID,
  getGlobalUserParams,
  getGlobalDB,
  getGlobalDBFromCtx,
  StaticDatabases,
} = require("@budibase/auth/db")
const { hash, getGlobalUserByEmail } = require("@budibase/auth").utils
const { UserStatus, EmailTemplatePurpose } = require("../../../constants")
const { DEFAULT_TENANT_ID } = require("@budibase/auth/constants")
const { checkInviteCode } = require("../../../utilities/redis")
const { sendEmail } = require("../../../utilities/email")
const { user: userCache } = require("@budibase/auth/cache")
const { invalidateSessions } = require("@budibase/auth/sessions")
const CouchDB = require("../../../db")
const env = require("../../../environment")

const PLATFORM_INFO_DB = StaticDatabases.PLATFORM_INFO.name
const TENANT_DOC = StaticDatabases.PLATFORM_INFO.docs.tenants

async function tryAddTenant(tenantId, userId, email) {
  const db = new CouchDB(PLATFORM_INFO_DB)
  const getDoc = async id => {
    if (!id) {
      return null
    }
    try {
      return await db.get(id)
    } catch (err) {
      return { _id: id }
    }
  }
  let [tenants, userIdDoc, emailDoc] = await Promise.all([
    getDoc(TENANT_DOC),
    getDoc(userId),
    getDoc(email),
  ])
  if (!Array.isArray(tenants.tenantIds)) {
    tenants = {
      _id: TENANT_DOC,
      tenantIds: [],
    }
  }
  let promises = []
  if (userIdDoc) {
    userIdDoc.tenantId = tenantId
    promises.push(db.put(userIdDoc))
  }
  if (emailDoc) {
    emailDoc.tenantId = tenantId
    promises.push(db.put(emailDoc))
  }
  if (tenants.tenantIds.indexOf(tenantId) === -1) {
    tenants.tenantIds.push(tenantId)
    promises.push(db.put(tenants))
  }
  await Promise.all(promises)
}

async function doesTenantExist(tenantId) {
  const db = new CouchDB(PLATFORM_INFO_DB)
  let tenants
  try {
    tenants = await db.get(TENANT_DOC)
  } catch (err) {
    // if theres an error the doc doesn't exist, no tenants exist
    return false
  }
  return (
    tenants &&
    Array.isArray(tenants.tenantIds) &&
    tenants.tenantIds.indexOf(tenantId) !== -1
  )
}

async function allUsers(ctx) {
  const db = getGlobalDBFromCtx(ctx)
  const response = await db.allDocs(
    getGlobalUserParams(null, {
      include_docs: true,
    })
  )
  return response.rows.map(row => row.doc)
}

async function saveUser(user, tenantId) {
  if (!tenantId) {
    throw "No tenancy specified."
  }
  const db = getGlobalDB(tenantId)
  let { email, password, _id } = user
  // make sure another user isn't using the same email
  let dbUser
  if (email) {
    dbUser = await getGlobalUserByEmail(email, tenantId)
    if (dbUser != null && (dbUser._id !== _id || Array.isArray(dbUser))) {
      throw "Email address already in use."
    }
  } else {
    dbUser = await db.get(_id)
  }

  // get the password, make sure one is defined
  let hashedPassword
  if (password) {
    hashedPassword = await hash(password)
  } else if (dbUser) {
    hashedPassword = dbUser.password
  } else {
    throw "Password must be specified."
  }

  _id = _id || generateGlobalUserID()
  user = {
    ...dbUser,
    ...user,
    _id,
    password: hashedPassword,
    tenantId,
  }
  // make sure the roles object is always present
  if (!user.roles) {
    user.roles = {}
  }
  // add the active status to a user if its not provided
  if (user.status == null) {
    user.status = UserStatus.ACTIVE
  }
  try {
    const response = await db.put({
      password: hashedPassword,
      ...user,
    })
    await tryAddTenant(tenantId, _id, email)
    await userCache.invalidateUser(response.id)
    return {
      _id: response.id,
      _rev: response.rev,
      email,
    }
  } catch (err) {
    if (err.status === 409) {
      throw "User exists already"
    } else {
      throw err
    }
  }
}

exports.save = async ctx => {
  // this always stores the user into the requesting users tenancy
  const tenantId = ctx.user.tenantId
  try {
    ctx.body = await saveUser(ctx.request.body, tenantId)
  } catch (err) {
    ctx.throw(err.status || 400, err)
  }
}

exports.adminUser = async ctx => {
  const { email, password, tenantId } = ctx.request.body
  if (await doesTenantExist(tenantId)) {
    ctx.throw(403, "Organisation already exists.")
  }

  const db = getGlobalDB(tenantId)
  const response = await db.allDocs(
    getGlobalUserParams(null, {
      include_docs: true,
    })
  )

  if (response.rows.some(row => row.doc.admin)) {
    ctx.throw(
      403,
      "You cannot initialise once an global user has been created."
    )
  }

  const user = {
    email: email,
    password: password,
    roles: {},
    builder: {
      global: true,
    },
    admin: {
      global: true,
    },
    tenantId,
  }
  try {
    ctx.body = await saveUser(user, tenantId)
  } catch (err) {
    ctx.throw(err.status || 400, err)
  }
}

exports.destroy = async ctx => {
  const db = getGlobalDBFromCtx(ctx)
  const dbUser = await db.get(ctx.params.id)
  await db.remove(dbUser._id, dbUser._rev)
  await userCache.invalidateUser(dbUser._id)
  await invalidateSessions(dbUser._id)
  ctx.body = {
    message: `User ${ctx.params.id} deleted.`,
  }
}

exports.removeAppRole = async ctx => {
  const { appId } = ctx.params
  const db = getGlobalDBFromCtx(ctx)
  const users = await allUsers(ctx)
  const bulk = []
  const cacheInvalidations = []
  for (let user of users) {
    if (user.roles[appId]) {
      cacheInvalidations.push(userCache.invalidateUser(user._id))
      delete user.roles[appId]
      bulk.push(user)
    }
  }
  await db.bulkDocs(bulk)
  await Promise.all(cacheInvalidations)
  ctx.body = {
    message: "App role removed from all users",
  }
}

exports.getSelf = async ctx => {
  if (!ctx.user) {
    ctx.throw(403, "User not logged in")
  }
  ctx.params = {
    id: ctx.user._id,
  }
  // this will set the body
  await exports.find(ctx)
}

exports.updateSelf = async ctx => {
  const db = getGlobalDBFromCtx(ctx)
  const user = await db.get(ctx.user._id)
  if (ctx.request.body.password) {
    ctx.request.body.password = await hash(ctx.request.body.password)
  }
  // don't allow sending up an ID/Rev, always use the existing one
  delete ctx.request.body._id
  delete ctx.request.body._rev
  const response = await db.put({
    ...user,
    ...ctx.request.body,
  })
  await userCache.invalidateUser(user._id)
  ctx.body = {
    _id: response.id,
    _rev: response.rev,
  }
}

// called internally by app server user fetch
exports.fetch = async ctx => {
  const users = await allUsers(ctx)
  // user hashed password shouldn't ever be returned
  for (let user of users) {
    if (user) {
      delete user.password
    }
  }
  ctx.body = users
}

// called internally by app server user find
exports.find = async ctx => {
  const db = getGlobalDBFromCtx(ctx)
  let user
  try {
    user = await db.get(ctx.params.id)
  } catch (err) {
    // no user found, just return nothing
    user = {}
  }
  if (user) {
    delete user.password
  }
  ctx.body = user
}

exports.tenantLookup = async ctx => {
  const id = ctx.params.id
  // lookup, could be email or userId, either will return a doc
  const db = new CouchDB(PLATFORM_INFO_DB)
  let tenantId = null
  try {
    const doc = await db.get(id)
    if (doc && doc.tenantId) {
      tenantId = doc.tenantId
    }
  } catch (err) {
    if (!env.MULTI_TENANCY) {
      tenantId = DEFAULT_TENANT_ID
    } else {
      ctx.throw(400, "No tenant found.")
    }
  }
  ctx.body = {
    tenantId,
  }
}

exports.invite = async ctx => {
  let { email, userInfo } = ctx.request.body
  const tenantId = ctx.user.tenantId
  const existing = await getGlobalUserByEmail(email, tenantId)
  if (existing) {
    ctx.throw(400, "Email address already in use.")
  }
  if (!userInfo) {
    userInfo = {}
  }
  userInfo.tenantId = tenantId
  await sendEmail(tenantId, email, EmailTemplatePurpose.INVITATION, {
    subject: "{{ company }} platform invitation",
    info: userInfo,
  })
  ctx.body = {
    message: "Invitation has been sent.",
  }
}

exports.inviteAccept = async ctx => {
  const { inviteCode, password, firstName, lastName } = ctx.request.body
  try {
    // info is an extension of the user object that was stored by global
    const { email, info } = await checkInviteCode(inviteCode)
    // only pass through certain props for accepting
    ctx.request.body = {
      firstName,
      lastName,
      password,
      email,
      ...info,
    }
    ctx.user = {
      tenantId: info.tenantId,
    }
    // this will flesh out the body response
    await exports.save(ctx)
  } catch (err) {
    ctx.throw(400, "Unable to create new user, invitation invalid.")
  }
}
