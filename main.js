// TODO: RSI divergence strategy

"use strict";

const ccxt = require ('ccxt')
    , notification = require('./src/notifications')
    , storage = require('./src/subscribers')
    , config = require('config')
    , RSI = require ('technicalindicators').RSI
    , log  = require ('ololog').configure ({ locate: false, time: true })
    , ansi = require ('ansicolor').nice
    //, asTable = require ('as-table').configure ({ delimiter: ' | ' });

const arrayColumn = (arr, n) => arr.map(x => x[n])
    , sleep = ms => new Promise (resolve => setTimeout (resolve, ms));

let rsiIsOversold = function(currentValue) {
    return currentValue <= config.Indicator.RSI.low;
}

let rsiIsOverbought = function(currentValue) {
    return currentValue >= config.Indicator.RSI.high
}

let printUsage = function () {
    log.dim.info('Usage: node', process.argv[1], '5m'.bright.yellow, '10m'.bright.blue, '15m'.bright.green)
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
                log.bright.yellow.warn(exchangeName, market, '[DDoS Protection Error] ' + e.message)
            } else if (e instanceof ccxt.RequestTimeout) {
                log.bright.yellow.warn(exchangeName, market, '[Timeout Error] ' + e.message)
            } else if (e instanceof ccxt.AuthenticationError) {
                log.bright.yellow.warn(exchangeName, market, '[Authentication Error] ' + e.message)
            } else if (e instanceof ccxt.ExchangeNotAvailable) {
                log.bright.yellow.warn(exchangeName, market, '[Exchange Not Available Error] ' + e.message)
            } else if (e instanceof ccxt.ExchangeError) {
                log.bright.yellow.warn(exchangeName, market, '[Exchange Error] ' + e.message)
            } else {
                throw e; // rethrow all other exceptions
            }

            if(currentProxy == proxies.length-1) {
                log.bright.blue('Waiting for', config.App.waitSeconds, 'seconds')
                await sleep(config.App.waitSeconds * 1000)
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

        let timeframe = timeframes.slice(-1)[0]
        if(rsi.every(rsiIsOverbought)) {
            log.bright.magenta(exchangeConfig.name, market, timeframes, 'RSI:', rsi)
            notification.sendNotifications(market, timeframe, 'Overbought: ' + market + ' - Exchange: ' + exchangeConfig.name + ' ' + timeframes + ' RSI: ' + rsi)
        } else if(rsi.every(rsiIsOversold)) {
            log.bright.green(exchangeConfig.name, market, timeframes, 'RSI:', rsi)
            notification.sendNotifications(market, timeframe, 'Oversold: ' + market + ' - Exchange: ' + exchangeConfig.name + ' ' + timeframes + ' RSI: ' + rsi)
        } else {
            log.dim(exchangeConfig.name, market, timeframes, 'RSI:', rsi)
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
            log.bright.red.error(e.constructor.name, e.message)
            return
        }
    }
};

(async function main () {
    await storage.init()
    if (process.argv.length >= 3) {
        let timeframes = process.argv.slice(2)
        for(let i=0; i < config.Exchanges.length; i++) {
            // TODO: Scan a variaty of exchanges and markets asynchrone
            // TODO: Improve exception handling
            await scanExchange(config.Exchanges[i], timeframes)
        }
    }  else {
        printUsage()
    }
    process.exit ()
}) ()
