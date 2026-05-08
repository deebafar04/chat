#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const THIS_DIR = dirname(fileURLToPath(import.meta.url))
const CHAT_DIR = resolve(THIS_DIR, '..')
const WEBROOT = resolve(CHAT_DIR, '..')
const SOURCE_DIR = join(WEBROOT, 'sanity')
export const RUNTIME_DIR = join('/private/tmp', 'webroot-sanity-mounted')

const EXCLUDED_NAMES = new Set(['.git', '.next', 'node_modules'])

function replaceOnce(content, searchValue, replaceValue, label) {
	if (!content.includes(searchValue)) {
		throw new Error(`Unable to apply sanity runtime overlay for ${label}`)
	}
	return content.replace(searchValue, replaceValue)
}

function transformEnv(content) {
	return `${content}

export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\\/$/, '')

export function withBasePath(path = '/') {
	const normalizedPath = path.startsWith('/') ? path : \`/\${path}\`
	return \`\${BASE_PATH}\${normalizedPath}\`
}
`
}

function transformNextConfig(content) {
	let updated = content
	updated = replaceOnce(
		updated,
		"import { groq } from 'next-sanity'\nimport { ROUTES } from './src/lib/env'\nimport { client } from './src/sanity/lib/client'",
		"import { createClient, groq } from 'next-sanity'\nimport { BASE_PATH, ROUTES, withBasePath } from './src/lib/env'\nimport { apiVersion, dataset, projectId } from './src/sanity/env'\n\nconst client = createClient({\n\tprojectId,\n\tdataset,\n\tapiVersion,\n\tuseCdn: true,\n})",
		'next.config imports',
	)
	updated = replaceOnce(
		updated,
		'const nextConfig: NextConfig = {\n\treactCompiler: true,\n',
		'const nextConfig: NextConfig = {\n\treactCompiler: true,\n\tbasePath: BASE_PATH || undefined,\n',
		'next.config basePath',
	)
	updated = replaceOnce(
		updated,
		"\timages: {\n\t\tlocalPatterns: [{ pathname: '/api/og' }],",
		"\timages: {\n\t\tlocalPatterns: [{ pathname: withBasePath('/api/og') }],",
		'next.config localPatterns',
	)
	updated = replaceOnce(
		updated,
		"destination.internal->.metadata.slug.current == 'index' => '/',",
		"destination.internal->.metadata.slug.current == 'index' => $basePath + '/',",
		'next.config redirect index destination',
	)
	updated = replaceOnce(
		updated,
		"'/' + destination.internal->.metadata.slug.current",
		"$basePath + '/' + destination.internal->.metadata.slug.current",
		'next.config redirect slug destination',
	)
	updated = replaceOnce(
		updated,
		"\t\t\t{ blogDir: `/${ROUTES.blog}/` },",
		"\t\t\t{ basePath: BASE_PATH, blogDir: withBasePath(`/${ROUTES.blog}/`) },",
		'next.config redirect params',
	)
	return updated
}

function transformSanityClient(content) {
	let updated = content
	updated = replaceOnce(
		updated,
		"import { createClient } from 'next-sanity'",
		"import { withBasePath } from '@/lib/env'\nimport { createClient } from 'next-sanity'",
		'sanity client import',
	)
	updated = replaceOnce(
		updated,
		"stega: {\n\t\tstudioUrl: '/admin',\n\t},",
		"stega: {\n\t\tstudioUrl: withBasePath('/admin'),\n\t},",
		'sanity client studioUrl',
	)
	return updated
}

function transformPresentation(content) {
	let updated = content
	updated = replaceOnce(
		updated,
		"import { ROUTES } from '@/lib/env'",
		"import { ROUTES, withBasePath } from '@/lib/env'",
		'presentation import',
	)
	updated = replaceOnce(updated, "enable: '/api/draft-mode/enable',", "enable: withBasePath('/api/draft-mode/enable'),", 'presentation enable')
	updated = replaceOnce(updated, "disable: '/api/draft-mode/disable',", "disable: withBasePath('/api/draft-mode/disable'),", 'presentation disable')
	updated = replaceOnce(updated, "route: '/',", "route: withBasePath('/'),", 'presentation root route')
	updated = replaceOnce(updated, "route: '/:slug',", "route: withBasePath('/:slug'),", 'presentation slug route')
	updated = replaceOnce(updated, "route: `/${ROUTES.blog}/:slug`,", "route: withBasePath(`/${ROUTES.blog}/:slug`),", 'presentation blog route')
	updated = replaceOnce(
		updated,
		"href: !doc?.slug || doc.slug === 'index' ? '/' : `/${doc.slug}`,",
		"href: !doc?.slug || doc.slug === 'index' ? withBasePath('/') : withBasePath(`/${doc.slug}`),",
		'presentation page href',
	)
	updated = replaceOnce(
		updated,
		"? `/${ROUTES.blog}/${doc.slug}`\n\t\t\t\t\t\t\t\t: `/${ROUTES.blog}`,",
		"? withBasePath(`/${ROUTES.blog}/${doc.slug}`)\n\t\t\t\t\t\t\t\t: withBasePath(`/${ROUTES.blog}`),",
		'presentation blog href',
	)
	return updated
}

function transformVisualEditing(content) {
	let updated = content
	updated = replaceOnce(
		updated,
		"import { VisualEditing } from 'next-sanity/visual-editing'",
		"import { withBasePath } from '@/lib/env'\nimport { VisualEditing } from 'next-sanity/visual-editing'",
		'visual editing import',
	)
	updated = replaceOnce(updated, 'href="/api/draft-mode/disable"', "href={withBasePath('/api/draft-mode/disable')}", 'visual editing disable href')
	updated = replaceOnce(updated, 'href="/admin"', "href={withBasePath('/admin')}", 'visual editing admin href')
	return updated
}

function transformIcon(content) {
	let updated = content
	updated = replaceOnce(
		updated,
		'export default function () {',
		"import { withBasePath } from '@/lib/env'\n\nexport default function () {",
		'icon import',
	)
	updated = replaceOnce(updated, 'src="/favicon.ico"', "src={withBasePath('/favicon.ico')}", 'icon favicon path')
	return updated
}

function transformPage(content) {
	let updated = content
	updated = replaceOnce(
		updated,
		"import { ROUTES } from '@/lib/env'",
		"import { ROUTES, withBasePath } from '@/lib/env'",
		'page import',
	)
	updated = replaceOnce(
		updated,
		": `${process.env.NEXT_PUBLIC_BASE_URL}/api/og?slug=${slug?.join('/')}`,",
		": `${process.env.NEXT_PUBLIC_BASE_URL}${withBasePath(`/api/og?slug=${slug?.join('/') || ''}`)}`,",
		'page og path',
	)
	updated = replaceOnce(
		updated,
		"'application/rss+xml': `/${ROUTES.blog}/rss.xml`,",
		"'application/rss+xml': withBasePath(`/${ROUTES.blog}/rss.xml`),",
		'page rss path',
	)
	return updated
}

function transformBlogPostPage(content) {
	let updated = content
	updated = replaceOnce(
		updated,
		"import { ROUTES } from '@/lib/env'",
		"import { ROUTES, withBasePath } from '@/lib/env'",
		'blog page import',
	)
	updated = replaceOnce(
		updated,
		"url: `${process.env.NEXT_PUBLIC_BASE_URL}/${ROUTES.blog}/${slug}`,",
		"url: `${process.env.NEXT_PUBLIC_BASE_URL}${withBasePath(`/${ROUTES.blog}/${slug}`)}`,",
		'blog page url',
	)
	updated = replaceOnce(
		updated,
		": `${process.env.NEXT_PUBLIC_BASE_URL}/api/og?slug=${ROUTES.blog}/${slug}`,",
		": `${process.env.NEXT_PUBLIC_BASE_URL}${withBasePath(`/api/og?slug=${ROUTES.blog}/${slug}`)}`,",
		'blog page og path',
	)
	updated = replaceOnce(
		updated,
		"'application/rss+xml': `/${ROUTES.blog}/rss.xml`,",
		"'application/rss+xml': withBasePath(`/${ROUTES.blog}/rss.xml`),",
		'blog page rss path',
	)
	return updated
}

function transformBlogSchema(content) {
	let updated = content
	updated = replaceOnce(
		updated,
		"import { ROUTES } from '@/lib/env'",
		"import { ROUTES, withBasePath } from '@/lib/env'",
		'blog schema import',
	)
	updated = replaceOnce(
		updated,
		"url: `${process.env.NEXT_PUBLIC_BASE_URL}/${ROUTES.blog}/${slug?.current}`,",
		"url: `${process.env.NEXT_PUBLIC_BASE_URL}${withBasePath(`/${ROUTES.blog}/${slug?.current}`)}`,",
		'blog schema url',
	)
	updated = replaceOnce(
		updated,
		": `${process.env.NEXT_PUBLIC_BASE_URL}/api/og?slug=${ROUTES.blog}/${slug?.current}`,",
		": `${process.env.NEXT_PUBLIC_BASE_URL}${withBasePath(`/api/og?slug=${ROUTES.blog}/${slug?.current}`)}`,",
		'blog schema og path',
	)
	return updated
}

const TRANSFORMS = new Map([
	['next.config.ts', transformNextConfig],
	['src/lib/env.ts', transformEnv],
	['src/sanity/lib/client.ts', transformSanityClient],
	['src/sanity/presentation.ts', transformPresentation],
	['src/ui/modules/visual-editing.tsx', transformVisualEditing],
	['src/sanity/icon.tsx', transformIcon],
	['src/app/(frontend)/[[...slug]]/page.tsx', transformPage],
	['src/app/(frontend)/blog/[slug]/page.tsx', transformBlogPostPage],
	['src/ui/modules/blog/schema.tsx', transformBlogSchema],
])

async function mirrorSourceTree(sourceDir, runtimeDir) {
	await mkdir(runtimeDir, { recursive: true })
	const entries = await readdir(sourceDir, { withFileTypes: true })

	for (const entry of entries) {
		if (EXCLUDED_NAMES.has(entry.name)) continue

		const sourcePath = join(sourceDir, entry.name)
		const runtimePath = join(runtimeDir, entry.name)
		const relativePath = relative(SOURCE_DIR, sourcePath)

		if (entry.isDirectory()) {
			await mirrorSourceTree(sourcePath, runtimePath)
			continue
		}

		await mkdir(dirname(runtimePath), { recursive: true })

		if (TRANSFORMS.has(relativePath)) {
			const original = await readFile(sourcePath, 'utf8')
			const transformed = TRANSFORMS.get(relativePath)(original)
			await writeFile(runtimePath, transformed, 'utf8')
			continue
		}

		await symlink(sourcePath, runtimePath)
	}
}

export async function prepareSanityRuntime() {
	if (!existsSync(join(SOURCE_DIR, 'package.json'))) return null

	await rm(RUNTIME_DIR, { recursive: true, force: true })
	await mkdir(RUNTIME_DIR, { recursive: true })
	await mirrorSourceTree(SOURCE_DIR, RUNTIME_DIR)

	const nodeModulesSource = join(SOURCE_DIR, 'node_modules')
	if (existsSync(nodeModulesSource)) {
		await symlink(nodeModulesSource, join(RUNTIME_DIR, 'node_modules'))
	}

	return RUNTIME_DIR
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const runtimeDir = await prepareSanityRuntime()
	if (runtimeDir) {
		console.log(runtimeDir)
	}
}
