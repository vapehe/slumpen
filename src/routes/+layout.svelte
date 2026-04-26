<script lang="ts">
  import "../app.css";
  import logo from "$lib/assets/logo.png";

  let { children } = $props();
</script>

<header class="border-b border-neutral-200 bg-white">
  <div class="mx-auto flex max-w-5xl items-center justify-center px-6 py-6">
    <a href="/" class="inline-flex items-center" aria-label="Till startsidan">
      <img src={logo} alt="Slumpen" width="514" height="514" class="h-20 w-auto sm:h-24" />
    </a>
    <h1 class="text-6xl font-bold font-kalam ml-4">Slumpen</h1>
  </div>
</header>

{@render children()}
