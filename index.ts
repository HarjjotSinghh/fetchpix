import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import axios from 'axios'
import * as cheerio from 'cheerio'
import pino from 'pino'
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'

const logger = pino({
    level: 'info', msgPrefix: 'SERVER | ', safe: true, timestamp: true, base: null, formatters: { level: (label) => ({ level: label }) }, serializers: { err: pino.stdSerializers.err }, write: (msg) => console.log(msg)
})


const app = new Hono()

interface ImageResponse {
    url: string
    time_taken: string
    download_url: string
}

async function fetchImageUrls(query: string): Promise<string[]> {
    const url = `https://pxhere.com/en/photos?q=${encodeURIComponent(query)}&search=&NSFW=off`
    try {
        const startTime = Date.now()
        const { data } = await axios.get(url)
        const $ = cheerio.load(data)
        const imageUrls = $('img[src^="https://"]')
            .map((_, el) => $(el).attr('src'))
            .get()
            .filter(Boolean) as string[]

        logger.info(`Fetched ${imageUrls.length} images in ${Date.now() - startTime}ms`)

        return imageUrls
    } catch (error) {
        logger.error('An error occurred:', error)
        return []
    }
}

function getDownloadUrl(randomUrl: string): string {
    const urlParts = randomUrl.split('/');
    const imageId = urlParts[urlParts.length - 1].split('-').pop()?.split('.')[0];
    if (!imageId) {
        throw new Error('Invalid image URL');
    }
    return `https://get.pxhere.com/photo/landscape-nature-snow-cold-winter-animal-cute-country-bear-wildlife-rural-weather-mammal-iceland-arctic-polar-bear-arctic-fox-outdoors-hdr-vertebrate-freezing-samoyed-dog-breed-group-${imageId}.jpg?attachment`;
}

if (isMainThread) {
    app.get('/', async (c) => {
        const startTime = Date.now()
        const query = c.req.query('q') || 'blue sky'

        const worker = new Worker(__filename, { workerData: query })

        return new Promise((resolve) => {
            worker.on('message', (imageUrls: string[]) => {
                if (imageUrls.length === 0) {
                    resolve(c.json({ error: 'No images found for the given query' }, 404))
                } else {
                    const randomUrl = imageUrls[Math.floor(Math.random() * imageUrls.length)]
                    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2)
                    const response: ImageResponse = {
                        url: randomUrl.replaceAll("!s1", "!d"),
                        time_taken: `${timeTaken} seconds`,
                        download_url: getDownloadUrl(randomUrl)
                    }

                    resolve(c.json(response))
                }
            })
        })
    })

    const port = process.env.PORT ? parseInt(process.env.PORT) : 5000
    logger.info(`Successfully started server on port ${port}`)

    serve({
        fetch: app.fetch,
        port
    })
} else {
    (async () => {
        const imageUrls = await fetchImageUrls(workerData)
        parentPort?.postMessage(imageUrls)
    })()
}