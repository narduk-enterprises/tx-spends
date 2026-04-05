export default defineNuxtRouteMiddleware((to, from) => {
  // Only apply filter preservation when navigating across different pages
  if (to.path === from.path) {
    return
  }

  // Keys that represent app-wide context that should follow the user unless explicitly cleared
  const preservedKeys = ['fy', 'include_confidential']
  
  let needsUpdate = false
  const inheritedQuery = { ...to.query }

  for (const key of preservedKeys) {
    // If the outgoing page had a global filter, but the destination doesn't specify one, carry it over
    if (from.query[key] !== undefined && to.query[key] === undefined) {
      inheritedQuery[key] = from.query[key]
      needsUpdate = true
    }
  }

  if (needsUpdate) {
    return navigateTo({
      path: to.path,
      query: inheritedQuery,
      hash: to.hash,
    })
  }
})
