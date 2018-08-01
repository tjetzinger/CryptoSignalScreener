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

let rsiIsOversold = function(currentValue) {
    return currentValue <= 30;
}

let rsiIsOverbought = function(currentValue) {
    return currentValue >= 70;
}

let printUsage = function () {
    log('Usage: node'.dim, process.argv[1].dim, '5m'.bright.yellow, '10m'.bright.blue, '15m'.bright.green)
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

let rsiAlert = async function (exchange, market, exchangeConfig, timeframes) {
    try {
        let rsi = []
        for(let i = 0; i < timeframes.length; i++) {
            let ohlcv = await fetchOHLCV(exchange, market, timeframes[i])
            let closes = arrayColumn(ohlcv, 4)
            let result = RSI.calculate({period: config.Indicator.RSI.period, values: closes, reversedInput: false}).pop()
            rsi.push(result)
        }

        // TODO: Send alert only once
        // TODO: Examine on divergence
        if(rsi.every(rsiIsOverbought)) {
            log.bright.red(exchangeConfig.name, market, timeframes, rsi)
            telegram.sendAlert('Overbought: ' + market + ' - Exchange: ' + exchangeConfig.name + ' ' + timeframes + ' ' + rsi)
        } else if(rsi.every(rsiIsOversold)) {
            log.bright.green(exchangeConfig.name, market, timeframes, rsi)
            telegram.sendAlert('Oversold: ' + market + ' - Exchange: ' + exchangeConfig.name + ' ' + timeframes + ' ' + rsi)
        } else {
            log.dim(exchangeConfig.name, market, timeframes, rsi)
        }
    } catch (e) {
        throw e; // rethrow all exceptions
    }
};

let scanExchange = async function (exchangeConfig, timeframes) {
    let exchange = new ccxt[exchangeConfig.id]({ rateLimit: exchangeConfig.rateLimit, enableRateLimit: true })
    let markets = exchangeConfig.markets

    // basic round-robin proxy scheduler
    for(let i = 0; i < markets.length; i = ++i % markets.length) {
        try {
            await rsiAlert(exchange, markets[i], exchangeConfig, timeframes)
        } catch (e) {
            log.bright.red(e.constructor.name, e.message)
            return
        }
    }
};

(async function main () {
    if (process.argv.length >= 3) {
        let timeframes = process.argv.slice(2)
        for(let i=0; i < config.Exchanges.length; i++) {
            // TODO: Scan asynchrone
            // TODO: Exception handling
            await scanExchange(config.Exchanges[i], timeframes)
        }
    }  else {
        printUsage()
    }
    process.exit ()
}) ()
