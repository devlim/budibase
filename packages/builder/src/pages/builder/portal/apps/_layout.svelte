<script>
  import { notifications } from "@budibase/bbui"
  import { apps, templates, licensing, groups } from "stores/portal"
  import { onMount } from "svelte"
  import { goto } from "@roxi/routify"

  // Don't block loading if we've already hydrated state
  let loaded = $apps.length > 0

  onMount(async () => {
    try {
      // Always load latest
      await apps.load()
      await licensing.init()
      await templates.load()

      if ($licensing.groupsEnabled) {
        await groups.actions.init()
      }

      if ($templates?.length === 0) {
        notifications.error("There was a problem loading quick start templates")
      }

      // Go to new app page if no apps exists
      if (!$apps.length) {
        $goto("./create")
      }
    } catch (error) {
      notifications.error("Error loading apps and templates")
    }
    loaded = true
  })
</script>

{#if loaded}
  <slot />
{/if}
