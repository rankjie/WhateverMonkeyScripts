// ==UserScript==
// @name         Funda - Walterliving Report
// @namespace    http://tampermonkey.net/
// @version      0.2.1
// @description  Grab info from Walterliving.
// @author       Beexio BV
// @match        *://www.funda.nl/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=walterliving.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.walterliving.com
// @downloadURL  https://raw.githubusercontent.com/rankjie/WhateverMonkeyScripts/main/Funda%20-%20Walterliving%20Report.js
// @updateURL    https://raw.githubusercontent.com/rankjie/WhateverMonkeyScripts/main/Funda%20-%20Walterliving%20Report.js
// ==/UserScript==



(async function() {
    'use strict';

    const findSpanWithText = (text) => {
        const textNodes = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        // Find text nodes that start with '€ '
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim().startsWith(text)) {
                textNodes.push(node);
            }
        }

        // Get the parent elements of these text nodes
        const priceElements = textNodes.map(node => node.parentElement);

        // Display the first match (if you expect only one)
        if (priceElements.length > 0) {
            return priceElements[0]
        }
        return null
    }

    const sleep = async (t) => {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, t)
        })
    }

    const getCurrentAskingSpan = async () => {
        let tried = 0
        do {
            try {
                const span = findSpanWithText('€ ')
                if (span) {
                    return span
                }
                console.log('askingSpan is null, sleep for 500ms then try again..')
            } catch (e) {
                console.log('get askingSpan failed, sleep for 500ms then try again. Err is:', e)
            }
            await sleep(500)
            tried += 1
        } while (tried < 5)
    }

    const actualFundaFuction = async () => {
        // await sleep(1.5 * 1000);
        const listing_title_regexp = /.*:\ (?<address>.*)\ (?<zipcode>\d{4}\ [A-Z]{2})\ (?<city>.*)\ \[funda\]$/;
        const listing_url_regexp = /https:\/\/www\.funda\.nl\/koop\/.*\/.*\/$/;
        const getTargetElement = () => {
            let ret = document.getElementById('about')
//            if (!ret || location.href.includes('/detail/')) {
//                ret = document.getElementsByClassName('object-header__container')[0].parentElement.nextElementSibling
//                const newElement = document.createElement("div")
//                newElement.setAttribute('id', 'walter-info')
//                newElement.setAttribute('class', 'w-full')
//                ret.appendChild(newElement)
//                return newElement
//            }
            const newElement = document.createElement("div")
            newElement.setAttribute('id', 'walter-info')
            newElement.setAttribute('class', 'w-full')
            ret.appendChild(newElement)
            return newElement
        }
        GM_addStyle(`
--tooltipWidth: auto;

span {
  position: relative;
}

[data-tooltip] {
  position: relative;
  cursor: help;
  text-decoration: underline;
}
[data-tooltip][data-position=right]::before {
  top: -50%;
  left: 105%;
  transform: translateX(-20px);
}
[data-tooltip][data-position=bottom]::before {
  top: 150%;
  transform: translateY(-20px);
}
[data-tooltip][data-position=left]::before {
  top: -50%;
  right: 105%;
  left: auto;
  transform: translateX(20px);
}
[data-tooltip]:hover::before {
  transform: translate(0);
  opacity: 1;
}
[data-tooltip]::before {
  content: attr(data-tooltip);
  position: absolute;
  width: var(--tooltipWidth);
  display: block;
  color: #FFF;
  background: #000;
  padding: 2px 10px;
  top: -50px;
  box-shadow: 0px 2px 5px #0000008c;
  border-radius: 1rem;
  text-align: center;
  left: 0;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transform: translateY(20px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
`)
        function fetchListingInfo() {
            const addrElement = document.querySelector('div[neighborhoodidentifier][city][postcode][housenumber]')
            const addressArr = addrElement.textContent
            const houseNumber = addrElement.getAttribute('housenumber')
            const zipCode = addrElement.getAttribute('postcode')
            let data
            data = JSON.stringify({
                "url": location.href,
                "address": addressArr,
                "zipcode": zipCode
            });
//            if (found && found.groups && found.groups.zipcode && found.groups.address) {
//            } else {
//                data = JSON.stringify({
//                    "url": location.href
//                });
//            }
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
        await displaySpeed(ret)
        async function displaySpeed(infoObj) {
            let targetElement = getTargetElement()
            console.log('targetElement is', targetElement);
            targetElement.insertAdjacentHTML('afterend', `
    <div class="w-full grid grid-cols-2" id="real-walterinfo">
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
                const askingSpan = await getCurrentAskingSpan()
                console.log('askingSpan is', askingSpan)
                const currentAsking = Number(askingSpan.textContent.split(/\s+/g)[1].replace(/\./g, '').replace(/\,/g, ''))
                console.log('currentAsking', currentAsking)
                const {change, changeShort, changePct} = calcChange(currentAsking, lastWoz.price)
                console.log('changePct:', changePct)
                askingSpan.insertAdjacentHTML('afterend', `<span style="font-size: smaller;font-weight: normal;margin-left: 5px;">${change > 0 ? '🥵' : '🤑'} WOZ ${change > 0 ? '+' : ''}${changeShort.num}${changeShort.metric} (${changePct}%)</span>`)
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
                let str = `<span data-tooltip="${el.human_price}" data-position="left">${el.date}: ${el.human_price.slice(0, 1)}${price.num}${price.metric}</span>`
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
    }

    const interval = setInterval(() => {
        console.log(document.readyState)
        if (document.readyState === 'complete') {
            actualFundaFuction()
            clearInterval(interval)
        }
    }, 500)
})();
