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
  content = content.replace(/from\(counties\)/g, 'from(geographiesCounties)')
  fs.writeFileSync(file, content)
}

const vueFiles = walk(path.join(process.cwd(), 'apps/web/app/pages'))
for (const file of vueFiles) {
  if (!file.endsWith('.vue')) continue
  let content = fs.readFileSync(file, 'utf8')

  // Fix detail.data.total_spend
  content = content.replace(/detail\.data\.total_spend/g, '(detail.data as any).total_spend')

  // Fix row.property errors
  content = content.replace(/\brow\.county_id/g, '(row as any).county_id')
  content = content.replace(/\brow\.agency_id/g, '(row as any).agency_id')
  content = content.replace(/\brow\.payee_id/g, '(row as any).payee_id')
  content = content.replace(/\brow\.category_code/g, '(row as any).category_code')
  content = content.replace(/\brow\.total_spend/g, '(row as any).total_spend')
  content = content.replace(/\brow\.payment_date/g, '(row as any).payment_date')
  content = content.replace(/\brow\.agency_name/g, '(row as any).agency_name')
  content = content.replace(/\brow\.payee_name/g, '(row as any).payee_name')

  // Fix script for query string building
  if (file.endsWith('transactions/index.vue')) {
    content = content.replace(/buildQueryString\(route\.query\)/g, 'getQuery(route.query)')
    if (!content.includes('const getQuery')) {
      content = content.replace(
        /const route = useRoute\(\)/,
        `const route = useRoute()\nconst getQuery = (q: any) => new URLSearchParams(q).toString()`,
      )
    }
    // Remove the bad script block
    content = content.replace(/<script>\nfunction buildQueryString[\s\S]*?<\/script>/, '')
  }

  fs.writeFileSync(file, content)
}

const searchComponent = path.join(process.cwd(), 'apps/web/app/components/GlobalSearch.vue')
if (fs.existsSync(searchComponent)) {
  let content = fs.readFileSync(searchComponent, 'utf8')
  content = content.replace(/data\.value\?\.data\?\.results/g, '(data.value?.data as any)?.results')
  content = content.replace(
    /data\.value\.data\.results\.map/g,
    '((data.value.data as any).results as any[]).map',
  )
  fs.writeFileSync(searchComponent, content)
}

console.log('Third pass done!')
