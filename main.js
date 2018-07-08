"use strict";

const ccxt = require ('ccxt')
    , telegram = require('./telegram')
    , config = require('config')
    , RSI = require ('technicalindicators').RSI
    , log  = require ('ololog').configure ({ locate: false })
    , ansi = require ('ansicolor').nice
    , asTable = require ('as-table').configure ({ delimiter: ' | ' });

const arrayColumn = (arr, n) => arr.map(x => x[n])
    , sleep = ms => new Promise (resolve => setTimeout (resolve, ms));

let printUsage = function () {
    log('Usage: node'.dim, process.argv[1].dim, '5m'.bright.red)
}

let fetchOHLCV = async function (exchange, market, timeframe) {
    let proxies = config.App.proxies
    let exchangeName = exchange.name.split(' ')[0]

    // basic round-robin proxy scheduler
    for (let currentProxy = 0, numRetries = 0; currentProxy < proxies.length; numRetries++) {
        try {
            exchange.proxy = proxies[currentProxy]
            return await exchange.fetchOHLCV(market, timeframe)
        } catch (e) { // rotate proxies in case of connectivity errors, catch all other exceptions
            // swallow connectivity exceptions only
            if (e instanceof ccxt.DDoSProtection || e.message.includes('ECONNRESET')) {
                log.bright.yellow(exchangeName, market, '[DDoS Protection Error] ' + e.message)
            } else if (e instanceof ccxt.RequestTimeout) {
                log.bright.yellow(exchangeName, market, '[Timeout Error] ' + e.message)
            } else if (e instanceof ccxt.AuthenticationError) {
                log.bright.yellow(exchangeName, market, '[Authentication Error] ' + e.message)
            } else if (e instanceof ccxt.ExchangeNotAvailable) {
                log.bright.yellow(exchangeName, market, '[Exchange Not Available Error] ' + e.message)
            } else if (e instanceof ccxt.ExchangeError) {
                log.bright.yellow(exchangeName, market, '[Exchange Error] ' + e.message)
            } else {
                throw e; // rethrow all other exceptions
            }

            if(currentProxy == proxies.length-1) {
                log.bright.blue('Waiting for', waitSeconds, 'seconds')
                await sleep(waitSeconds * 1000)
            }

            // retry next proxy in round-robin fashion in case of error
            currentProxy = ++currentProxy % proxies.length
        }
    }
};

let rsiAlert = function (ohlcv, market, exchangeName) {
    try {
        let closes = arrayColumn(ohlcv, 4)
        let rsi = RSI.calculate({period: config.Indicator.RSI.period, values: closes, reversedInput: false}).pop()
        // TODO: Send alert only once
        // TODO: Examine on divergence
        // TODO: Consider higher timeframe
        if(rsi >= 70) {
            log.bright.red(exchangeName, market, rsi)
            telegram.sendAlert('Short Market: ' + market + ' - Exchange: ' + exchangeName + ' - RSI: ' + rsi)
        } else if(rsi <= 30) {
            log.bright.green(exchangeName, market, rsi)
            telegram.sendAlert('Long Market: ' + market + ' - Exchange: ' + exchangeName + ' - RSI: ' + rsi)
        } else {
            log.dim(exchangeName, market, rsi)
        }
    } catch (e) {
        throw e; // rethrow all exceptions
    }
};

let scanExchange = async function (exchangeConfig, timeframe) {
    let exchange = new ccxt[exchangeConfig.id]({ rateLimit: exchangeConfig.rateLimit, enableRateLimit: true })
    let markets = exchangeConfig.markets

    // basic round-robin proxy scheduler
    for(let i = 0; i < markets.length; i = ++i % markets.length) {
        try {
            let ohlcv = await fetchOHLCV(exchange, markets[i], timeframe)
            rsiAlert(ohlcv, markets[i], exchangeConfig.name)
        } catch (e) {
            log.bright.red(e.constructor.name, e.message)
            return
        }
    }
};

(async function main () {
    if (process.argv.length == 3) {
        let args = process.argv.slice(2)
        let timeframe = args[0]
        for(let i=0; i < config.Exchanges.length; i++) {
            // TODO: Scan asynchrone
            // TODO: Exception handling
            await scanExchange(config.Exchanges[i], timeframe)
        }
    }  else {
        printUsage()
    }
    process.exit ()
}) ()
