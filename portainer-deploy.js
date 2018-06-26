#!/usr/bin/env node
const args = require('yargs')
    .command('$0 [stack] [compose] [url]', 'deploy stack', (yargs) => {
        yargs
            .option('endpoint-id', {
                alias: 'e',
                default: 1
            })
            .positional('stack', {
                describe: 'stack name'
            })
            .positional('compose', {
                describe: 'compose file'
            })
            .positional('url', {
                describe: 'api endpoint'
            })
            .demandOption(['stack', 'compose', 'url'], 'Please provide all required arguments')
    }, async (argv) => {
        const url = require('url')
        const fs = require('fs')

        const stack = argv.stack
        const endpoint = new url.URL(argv.url)
        const endpointId = parseInt(argv.e) || 1
        const compose = await new Promise((resolve, reject) => fs.readFile(argv.compose, 'utf8', (err, data) => {
            if (err)
                return reject(err)
            resolve(data)
        }))

        const token = (await request(getPath(endpoint, 'auth'), {
            "Username": process.env.PORTAINER_USER || "user",
            "Password": process.env.PORTAINER_PASS || "password"
        })).jwt

        const stacks = await request(getPath(endpoint, 'stacks'), '', token, 'get')
        const stackId = (stacks.find(obj => obj.Name == stack) || {}).Id
        if (stackId) {
            const ep = getPath(endpoint, 'stacks', stackId)
            ep.search = 'endpointId=' + endpointId
            console.log(await request(ep, {
                StackFileContent: compose,
                Prune: true,
                Env: []
            }, token, 'put'))
        } else {
            const swarm = (await request(getPath(endpoint, 'endpoints', endpointId, 'docker/swarm'), '', token, 'get')).ID
            const ep = getPath(endpoint, 'stacks')
            ep.search = 'method=string&type=1&endpointId=' + endpointId
            console.log(await request(ep, {
                StackFileContent: compose,
                Name: stack,
                Env: [],
                SwarmId: swarm
            }, token, 'post'))
        }
    })
    .argv

async function request(url, body = '', jwt = '', method = 'POST') {
    return new Promise((resolve, reject) => {
        let req = (url.protocol == 'https:' ? require('https') : require('http')).request({
            host: url.hostname,
            port: url.port || (url.protocol == 'https:' ? 443 : 80),
            path: url.pathname + url.search || '',
            searchParams: url.searchParams,
            method: method.toUpperCase(),
            headers: {
                'Content-type': 'application/json',
                'Charset': 'utf-8',
                'Authorization': jwt ? `Bearer ${jwt}` : ''
            }
        }, (res) => {
            let bufs = []
            res.on('data', d => bufs.push(d))
            res.on('end', () => {
                let data = Buffer.concat(bufs)
                resolve(JSON.parse(data.toString('utf8') || 'null'))
            })
        })
        req.on('error', (err) => reject(err))
        if (body && method.toUpperCase() != 'GET')
            req.write(JSON.stringify(body))
        req.end()
    })
}

function getPath(endpoint, ...params) {
    const path = require('path')
    const url = require('url')
    const ep = new url.URL(endpoint.toString())
    ep.pathname = path.normalize(path.join(ep.pathname, ...params.map(p => '' + (p || '')))).replace(/\\/g, '/')
    return ep
}