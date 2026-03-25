import fs from 'fs'
import path from 'path'

function walk(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach(function (file) {
    file = path.resolve(dir, file)
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file))
    } else {
      results.push(file)
    }
  })
  return results
}

const apiFiles = walk(path.join(process.cwd(), 'apps/web/server/api/v1'))
for (const file of apiFiles) {
  if (!file.endsWith('.ts')) continue
  let content = fs.readFileSync(file, 'utf8')

  // Fix imports
  content = content.replace(/#server\/api\//g, '#server/')

  // Fix query undefined
  content = content.replace(/const query = result\.data/g, 'const query = result.data!')

  if (file.endsWith('search.get.ts')) {
    if (!content.includes('import { sql }')) {
      content = "import { sql } from 'drizzle-orm';\n" + content
    }
    content = content.replace(/counties(?: as geographies_counties)?/g, 'geographies_counties')
  }

  // Implicit any for t
  content = content.replace(/\(t\) => {/g, '(t: any) => {')
  content = content.replace(/\(c\) => {/g, '(c: any) => {')
  content = content.replace(/\(p\) => {/g, '(p: any) => {')
  content = content.replace(/\(a\) => {/g, '(a: any) => {')

  // Fix implicit any without braces
  content = content.replace(/\(t\) => /g, '(t: any) => ')

  // Fix String(query.toUpperCase()) issue (toUpperCase doesn't exist on all types)
  content = content.replace(/query\.toUpperCase/g, 'String(query).toUpperCase')

  fs.writeFileSync(file, content)
}

const vueFiles = walk(path.join(process.cwd(), 'apps/web/app/pages'))
for (const file of vueFiles) {
  if (!file.endsWith('.vue')) continue
  let content = fs.readFileSync(file, 'utf8')

  // Fix URLSearchParams in template by putting it in script
  if (
    content.includes('new URLSearchParams(query).toString()') &&
    !content.includes('function buildQueryString')
  ) {
    content = content.replace(
      /new URLSearchParams\(query\)\.toString\(\)/g,
      'buildQueryString(query)',
    )
    content = content.replace(
      /<\/script>/,
      `
function buildQueryString(q: any) {
  return new URLSearchParams(q as any).toString();
}
</script>`,
    )
  }

  // Cast columns to any
  content = content.replace(/const columns = \[/g, 'const columns: any[] = [')

  // Any other row usage inside template should be fine if columns cast works, but just in case, define Row explicitly or cast.

  fs.writeFileSync(file, content)
}

const components = walk(path.join(process.cwd(), 'apps/web/app/components'))
for (const file of components) {
  if (!file.endsWith('.vue')) continue
  let content = fs.readFileSync(file, 'utf8')
  content = content.replace(/const columns = \[/g, 'const columns: any[] = [')

  // fix GlobalSearch.vue results.results error
  if (file.endsWith('GlobalSearch.vue')) {
    content = content.replace(/results\.results/g, '(results as any).results')
    content = content.replace(/results\.agencies/g, '(results as any).agencies')
    content = content.replace(/results\.payees/g, '(results as any).payees')
    content = content.replace(/results\.counties/g, '(results as any).counties')
  }

  fs.writeFileSync(file, content)
}

console.log('Done!')
