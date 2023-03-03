#!/usr/bin/env node

const HTMLParser = require("node-html-parser")
const fetch = require("node-fetch")
const https = require("https")
const fs = require("fs")
const path = require("path")
const { exec } = require("shelljs")

let verbose = false

async function run() {
  const args = process.argv.slice(2)
  const help = args.indexOf("--help") >= 0 || args.indexOf("-h") >= 0

  verbose = args.indexOf("--verbose") >= 0 || args.indexOf("-v") >= 0

  if (help) {
    console.log("Usage: twitch-emotes-downloader [options] [url]")
    console.log("Options:")
    console.log("  --help, -h     Print this message")
    console.log("  --verbose, -v  Print verbose progress updates")
    console.log('Example: twitch-emotes-downloader "https://www.twitch.tv/monstercat"')
    return
  }

  const twitchUrl = args.find((arg) => {
    return arg.indexOf("www.twitch.tv") >= 0
  })
  downloadEmotes(twitchUrl)
}

async function getUserIDFrom(username) {
  cmd = `curl -Ls -o /dev/null -w %{url_effective} 'https://twitchemotes.com/search/channel' -X POST -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/111.0' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate, br' -H 'Content-Type: application/x-www-form-urlencoded' -H 'Origin: https://twitchemotes.com' -H 'Alt-Used: twitchemotes.com' -H 'Connection: keep-alive' -H 'Referer: https://twitchemotes.com/' -H 'Upgrade-Insecure-Requests: 1' -H 'Sec-Fetch-Dest: document' -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Site: same-origin' -H 'Sec-Fetch-User: ?1' --data-raw 'query=${username}&source=nav-bar'`
  return new Promise((resolve, reject) => {
    exec(cmd, (_code, stdout, _stderr) => {
      if (stdout) {
        const userID = new URL(stdout).pathname.split("/").pop()
        resolve(userID)
      } else {
        console.error("Error: Could not get user ID")
        reject("Could not get user ID")
      }
    })
  })
}

function requestContent(id) {
  return fetch(`https://twitchemotes.com/channels/${id}`).then((res) =>
    res.text()
  )
}

function downloadEmoteImg({ username, url, emoteName }) {
  return https.get(url, (res) => {
    let savepath = path.join("twitch-emotes-dl", username, emoteName)
    const ext = res.headers["content-type"].split("/").pop()
    savepath += `.${ext}`
    if (fs.existsSync(savepath)) {
      if (verbose) {
        console.log(`    ':${emoteName}:' Already exists!`)
      }
      res.destroy()
      return
    }
    const writeStream = fs.createWriteStream(savepath)

    res.pipe(writeStream)

    writeStream.on("finish", () => {
      writeStream.close()
      if (verbose) {
        console.log(`    ':${emoteName}:' Downloaded!`)
      }
    })
  })
}

function createDownloadFolder(username) {
  if (verbose) {
    console.log(`Creating folder ${username}...`)
  }
  const dir = path.join("twitch-emotes-dl", username)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getUsernameFrom(twitchUrl) {
  const username = new URL(twitchUrl).pathname.split("/")[1]
  if (verbose) {
    console.log("Username is " + username)
  }
  return username
}

async function downloadEmotes(twitchUrl) {
  const username = getUsernameFrom(twitchUrl)
  const userID = await getUserIDFrom(username)
  const html = await requestContent(userID)
  const parsedHtml = HTMLParser.parse(html)
  const emoteCards = parsedHtml.querySelectorAll(".card-body>.row center")
  createDownloadFolder(username)
  const jobs = emoteCards.map((card) => {
    const url = card
      .querySelector("img")
      .getAttribute("src")
      .replace("2.0", "3.0")
    const emoteName = card.innerText.trim()

    return downloadEmoteImg({ username, url, emoteName })
  })
  console.log(`Downloading ${jobs.length} emotes...`)

  await Promise.all(jobs)
}

run()
