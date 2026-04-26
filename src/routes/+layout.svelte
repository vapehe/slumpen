<script lang="ts">
  import "../app.css";

  let { children } = $props();
</script>

<header class="border-b border-neutral-200 bg-white">
  <div class="mx-auto flex max-w-5xl items-center justify-center px-6 py-6">
    <a href="/" class="inline-flex items-center" aria-label="Till startsidan">
      <img src="/Logo_slumpen.png" alt="Slumpen" class="h-20 w-auto sm:h-24" />
    </a>
  </div>
</header>

{@render children()}
