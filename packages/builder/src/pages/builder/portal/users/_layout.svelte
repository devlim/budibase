<script>
  import { Page } from "@budibase/bbui"
  import { SideNav, SideNavItem, Content } from "components/portal/page"
  import { isActive } from "@roxi/routify"
  import { menu } from "stores/portal"

  $: wide = $isActive("./users/index") || $isActive("./groups/index")
  $: pages = $menu.find(x => x.title === "Users").subPages
</script>

<Page>
  <Content narrow={!wide}>
    <div slot="side-nav">
      <SideNav>
        {#each pages as { title, href }}
          <SideNavItem text={title} url={href} active={$isActive(href)} />
        {/each}
      </SideNav>
    </div>
    <slot />
  </Content>
</Page>
