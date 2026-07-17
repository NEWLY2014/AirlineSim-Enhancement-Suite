const fs = require("fs")

const [version, outputPath] = process.argv.slice(2)

if (!version || !outputPath) {
    throw new Error("Usage: node prepare-release-notes.js <version> <output-path>")
}

const lines = fs.readFileSync("CHANGELOG.md", "utf8").split(/\r?\n/)
const headingPrefix = `## [${version}] - `
const headingIndex = lines.findIndex(line => line.startsWith(headingPrefix))

if (headingIndex === -1) {
    throw new Error(`Could not find a Changelog section for version ${version}.`)
}

const nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && line.startsWith("## ")
)
const releaseBody = lines
    .slice(headingIndex + 1, nextHeadingIndex === -1 ? undefined : nextHeadingIndex)
    .join("\n")
    .trim()

if (!releaseBody) {
    throw new Error(`Changelog section for version ${version} is empty.`)
}

fs.writeFileSync(outputPath, `${releaseBody}\n`)
console.log(`title=${lines[headingIndex].slice(3)}`)
