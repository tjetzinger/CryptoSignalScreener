"use strict";

//TODO: Twitter Message

const telegram = require('./telegram')
    , storage = require('node-persist')
    , config = require('config')
    , log  = require ('ololog').configure ({ locate: false, time: true });

    const messageLock = storage.create({ dir: config.App.dirMessageLock })

module.exports = {
    init: async function() {
        await messageLock.init()
    },
    sendNotifications: async function(market, timeframe, message) {
        let lockKey = market + timeframe
        if(await messageLock.get(lockKey)) return
        telegram.sendSignal(message)
        this.setLock(lockKey, timeframe)
    },
    setLock: async function(key, timeframe) {
        let minutes = config.App.Timeframes[timeframe] * config.App.lockPeriod * 60
        await messageLock.set(key, true, { ttl: 1000 * minutes })
    }
};
