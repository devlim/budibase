<script>
  import { setContext } from "svelte"
  import clickOutside from "../Actions/click_outside"

  export let wide = false
  export let narrow = false
  export let noPadding = false

  let sidePanelVisble = false

  setContext("side-panel", {
    open: () => (sidePanelVisble = true),
    close: () => (sidePanelVisble = false),
  })
</script>

<div class="page">
  <div class="main">
    <div class="content" class:wide class:noPadding class:narrow>
      <slot />
    </div>
  </div>
  <div
    id="side-panel"
    class:visible={sidePanelVisble}
    use:clickOutside={() => {
      sidePanelVisble = false
    }}
  >
    <slot name="side-panel" />
  </div>
</div>

<style>
  .page {
    position: relative;
  }
  .page,
  .main {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: stretch;
    flex: 1 1 auto;
    overflow-x: hidden;
  }
  .main {
    overflow: auto;
  }
  .content {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    max-width: 1080px;
    margin: 0 auto;
    flex: 1 1 auto;
    padding: 50px;
    z-index: 1;
  }
  .content.wide {
    max-width: none;
  }
  .content.narrow {
    max-width: 840px;
  }
  #side-panel {
    position: absolute;
    right: 0;
    top: 0;
    padding: 24px;
    background: var(--background);
    border-left: var(--border-light);
    width: 320px;
    max-width: calc(100vw - 48px - 48px);
    overflow: auto;
    overflow-x: hidden;
    transform: translateX(100%);
    transition: transform 130ms ease-out;
    height: calc(100% - 48px);
    z-index: 2;
  }
  #side-panel.visible {
    transform: translateX(0);
  }

  @media (max-width: 640px) {
    .content {
      padding: 24px;
      max-width: calc(100vw - 48px) !important;
      width: calc(100vw - 48px) !important;
      overflow: auto;
    }
  }
</style>
