<script>
  import { onMount } from "svelte"
  import {
    Layout,
    Heading,
    Body,
    Button,
    Divider,
    notifications,
    Label,
  } from "@budibase/bbui"
  import { API } from "api"
  import { auth, admin } from "stores/portal"
  import { redirect } from "@roxi/routify"

  let version
  let loaded = false

  // Only admins allowed here
  $: {
    if (!$auth.isAdmin || $admin.cloud) {
      $redirect("../../portal")
    }
  }

  async function updateBudibase() {
    try {
      notifications.info("Updating budibase..")
      await fetch("/v1/update", {
        headers: {
          Authorization: "Bearer budibase",
        },
      })
      notifications.success("Your budibase installation is up to date.")
      getVersion()
    } catch (err) {
      notifications.error(`Error installing budibase update ${err}`)
    }
  }

  async function getVersion() {
    try {
      version = await API.getBudibaseVersion()
    } catch (error) {
      notifications.error("Error getting Budibase version")
      version = null
    }
  }

  onMount(async () => {
    await getVersion()
    loaded = true
  })
</script>

{#if $auth.isAdmin}
  <Layout noPadding>
    <Layout gap="XS" noPadding>
      <Heading size="M">Version</Heading>
      <Body>
        Keep your budibase installation up to date to take advantage of the
        latest features, security updates and much more
      </Body>
    </Layout>
    <Divider />
    {#if loaded}
      <Layout noPadding gap="XS">
        <Label size="L">Current version</Label>
        <Heading size="S">
          {version || "-"}
        </Heading>
      </Layout>
      <div>
        <Button cta on:click={updateBudibase}>Check for updates</Button>
      </div>
    {/if}
  </Layout>
{/if}
