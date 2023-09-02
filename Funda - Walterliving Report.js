// ==UserScript==
// @name         Funda - Walterliving Report
// @namespace    http://tampermonkey.net/
// @version      0.1.5
// @description  Grab info from Walterliving.
// @author       Beexio BV
// @match        *://www.funda.nl/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=walterliving.com
// @grant        GM_xmlhttpRequest
// @connect      api.walterliving.com
// @downloadURL  https://raw.githubusercontent.com/rankjie/WhateverMonkeyScripts/main/Funda%20-%20Walterliving%20Report.js
// @updateURL  https://raw.githubusercontent.com/rankjie/WhateverMonkeyScripts/main/Funda%20-%20Walterliving%20Report.js
// ==/UserScript==

(async function() {
    'use strict';
    const listing_title_regexp = /.*:\ (?<address>.*)\ (?<zipcode>\d{4}\ [A-Z]{2})\ (?<city>.*)\ \[funda\]$/;
    const listing_url_regexp = /https:\/\/www\.funda\.nl\/koop\/.*\/.*\/$/;
    function fetchListingInfo() {
        const found = document.title.match(listing_title_regexp);
        let data
        if (found && found.groups && found.groups.zipcode && found.groups.address) {
            data = JSON.stringify({
                "url": location.href,
                "address": found.groups.address,
                "zipcode": found.groups.zipcode
            });
        } else {
            data = JSON.stringify({
                "url": location.href
            });
        }
        console.log('post data:', data);
        return (new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: 'https://api.walterliving.com/hunter/lookup',
                method: 'POST',
                headers:{
                    'Content-Type': 'application/json'
                },
                data: data,
                onload: (r) => {
                    console.log('listing onload', r)
                    if (!['ok', 200].includes(r.status)) {
                        return resolve(r)
                    }
                    resolve(r.responseText)
                },
                onerror: (e) => {
                    console.log('get listing error:', e)
                    reject(e)
                }
            })
        })).then(text => {
            console.log('listing info:', text);
            try {
                return JSON.parse(text)
            } catch (e) {
                return text
            }
        })
    }
    const ret = await fetchListingInfo()
    console.log('ret is', ret)
    const wozs = ret.changes.filter(el => {
        // console.log(el)
        return el.source === 'WOZ'
    })
    const askingPrices = ret.changes.filter(el => el.status === "Vraagprijs")
    const wozString = genString(wozs)
    const askingString = genString(askingPrices)
    displaySpeed(ret)
    function displaySpeed(infoObj) {
        document.getElementsByClassName('object-header__pricing')[0].insertAdjacentHTML('beforebegin', `
    <div style="display:flex">
      <div style="flex: 0 0 50%;">
        <p style="font-size: 12px">
          <b>Asking:</b>
          <br>
          ${askingString}
        </p>
        <p><a href="${ret.report?.url}" target="_blank">${ret.report?.url ? 'Walter Report' : 'No Walter Report'}</a></p>
      </div>
      <div style="flex: 0 0 50%;">
        <p style="font-size: 12px">
          <b>WOZ:</b>
          <br>
          ${wozString}
        </p>
      </div>
    </div>`)
        if (wozs?.length) {

            const lastWoz = wozs?.reverse()[0]
            console.log('lastWoz', lastWoz.price)
            const currentAsking = Number(document.querySelector('.object-header__price').textContent.split(/\s+/g)[1].replace(/\./g, '').replace(/\,/g, ''))
            console.log('currentAsking', currentAsking)
            const {change, changeShort, changePct} = calcChange(currentAsking, lastWoz.price)
            console.log('changePct:', changePct)
            document.querySelector('.object-header__price').innerHTML = document.querySelector('.object-header__price').innerHTML + `<span style="font-size: smaller;font-weight: normal;margin-left: 5px;">${change > 0 ? '🥵' : '🤑'} WOZ ${change > 0 ? '+' : ''}${changeShort.num}${changeShort.metric} (${changePct}%)</span>`
        }
    }

    function calcChange(now, last) {
        console.log('comparing now - last:', now, last)
        if (!last) {
            return {change: 0, changePct: 0, changeShort: 0}
        }
        const change = now - last
        const changeShort = shortPrice(change)
        const changePct = Math.ceil(change / last * 100)
        return {change, changePct, changeShort}
    }

    function genString(arr) {
        const ret = []
        let last = null
        for (const el of arr.reverse()) {
            const price = shortPrice(el.price)
            let str = `${el.date}: ${el.human_price.slice(0, 1)}${price.num}${price.metric}`
            if (last) {
                const {change, changeShort, changePct} = calcChange(el.price, last.price)
                let color = `#7dd321`
                if (change < 0) {
                    color = `#e67e22`
                }
                const colorStyle = `color: ${color}`
                if (change) {
                    str += `<span style="${colorStyle};margin-left: 5px">${changeShort.num}${changeShort.metric} (${changePct}%)</span>`
                }
            }
            last = el
            ret.push(str)
        }
        return ret.reverse().join('<br>')
    }

    function shortPrice(price) {
        const m = Math.ceil(price / 100000) / 10
        if (m < 1) {
            return {num: Math.ceil(price / 1000) / 10, metric: '万'}
        }
        return {num: m, metric: 'm'}
    }

    function genWozString(wozs) {
        const ret = []
        for (const woz of wozs) {
            console.log('processing woz:', woz)
            const price = shortPrice(woz.human_price)
            console.log(price)
            ret.push(`${woz.date}: ${price.num}${price.metric}`)
        }
        return ret.join('<br>')
    }
})();
