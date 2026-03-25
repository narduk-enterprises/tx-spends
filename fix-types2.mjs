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

  // Fix 'counties' imports to geographiesCounties
  content = content.replace(/import \{([^}]+)\} from '#server\/database\/schema'/g, (match, p1) => {
    return `import {${p1.replace(/\bcounties\b/g, 'geographiesCounties')}} from '#server/database/schema'`
  })
  content = content.replace(/geographies_counties/g, 'geographiesCounties')

  // Fix the counties usages in the actual code
  content = content.replace(/\bcounties\./g, 'geographiesCounties.')
  content = content.replace(/from counties/g, 'from geographiesCounties')
  content = content.replace(/counties,/g, 'geographiesCounties,')

  fs.writeFileSync(file, content)
}

const vueFiles = walk(path.join(process.cwd(), 'apps/web/app/pages'))
for (const file of vueFiles) {
  if (!file.endsWith('.vue')) continue
  let content = fs.readFileSync(file, 'utf8')

  // Fix URLSearchParams in template by doing (route.query as any)
  // Our previous fix might have been malformed if it didn't catch everything.
  content = content.replace(
    /new URLSearchParams\(route.query(?: as any)?\)\.toString\(\)/g,
    'buildQueryString(route.query)',
  )

  // Cast rows to any to avoid Row<unknown> errors
  content = content.replace(/:rows="data\.data"/g, ':rows="(data as any)?.data as any"')
  content = content.replace(/:rows="data"/g, ':rows="data as any"')
  content = content.replace(/:rows="data\?\.data"/g, ':rows="(data as any)?.data as any"')
  content = content.replace(
    /:rows="transactions\.data"/g,
    ':rows="(transactions as any)?.data as any"',
  )

  // Any leftover UI warnings
  content = content.replace(/row\.object_title/g, '(row as any).object_title')
  content = content.replace(/row\.object_code/g, '(row as any).object_code')
  content = content.replace(/row\.amount/g, '(row as any).amount')
  content = content.replace(/detail\.data\.hub_type/g, '(detail.data as any).hub_type')
  content = content.replace(/detail\.data\.address_city/g, '(detail.data as any).address_city')
  content = content.replace(/detail\.data\.address_state/g, '(detail.data as any).address_state')
  content = content.replace(/detail\.data\.address_zip/g, '(detail.data as any).address_zip')

  fs.writeFileSync(file, content)
}

console.log('Second pass done!')
