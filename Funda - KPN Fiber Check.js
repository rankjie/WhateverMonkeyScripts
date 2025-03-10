// ==UserScript==
// @name         Funda KPN Fiber Check
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Get KPN Fiber status and Internet speed.
// @author       Beexio BV
// @match        *://www.funda.nl/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=kpn.com
// @grant        GM_xmlhttpRequest
// @connect      api-prd.kpn.com
// @require https://gist.github.com/raw/2625891/waitForKeyElements.js
// ==/UserScript==

(async function() {
    'use strict';

    const actualFuction = async () => {
        const sleep = async (t) => {
            return new Promise((resolve, reject) => {
                setTimeout(resolve, t)
            })
        }
        // await sleep(1 * 1000);

        let ret
        const KPN_TOKEN_KEY = "KPN_TOKEN_OBJ"

        const getTargetElement = () => {
            let ret = document.getElementById('about')
            const newElement = document.createElement("div")
            newElement.setAttribute('id', 'walter-info')
            newElement.setAttribute('class', 'w-full')
            ret.appendChild(newElement)
            return newElement
            //return ret
        }

        let targetElement = getTargetElement()
        let houseNumber
        let zipCode
        let newFunda
        let addressArr

        let ext = ""


        console.log('location.href is', location.href)
        // new version of funda
        if (location.href.includes('/detail/')) {
            console.log('new funda');
            newFunda = true;
            const addrElement = document.querySelector('div[neighborhoodidentifier][city][postcode][housenumber]')
            addressArr = addrElement.textContent
            houseNumber = addrElement.getAttribute('housenumber')
            zipCode = addrElement.getAttribute('postcode')
        }



        main()

        async function main() {
            try {
                showInfo('Fetching KPN Fiber Info...')
                const {access_token} = await getToken()
                console.log('access_token', access_token)

                ret = await getSpeed(access_token, houseNumber, zipCode, ext)
                console.log('ret:', ret)
                if (ret.error) {
                    throw ret
                }
                showInfo()
                displaySpeed(ret)
            } catch (e) {
                console.log('kpn err:', e)
                showInfo()
                showInfo('Fetch KPN Fiber Info Failed:' + JSON.stringify(e.error))
            }
        }

        function displaySpeed(infoObj) {
            getTargetElement().insertAdjacentHTML('afterEnd', `
    <div class="grid grid-cols-1 outline p-1 mt-4" id="kpn-info">
      <div>
        <p class="mb-0 color-secondary text-xs">Zip: <b>${zipCode}</b>; HouseNumber: <b>${houseNumber}</b>; Ext: <b>${ext}</b></p>
      </div>
      <div>
        <p class="object-header__price" style="font-size: 1rem;white-space: initial;">KPN Fiber: ${infoObj.fixed_info.fiber_access ? '✅' : '❌'} |
          <span class="px-2 py-1 bg-neutral-80-darken-2 rounded-full color-[#fff]">⬇️ ${infoObj.bandwidth.down || '-'}Mbps
           /
           ⬆️ ${infoObj.bandwidth.up || '-'}Mbps
          </span>
        </p>
      <div>
      <div>
        <details>
          <summary class="text-xs" style="cursor:pointer">Details</summary>
          <pre style="font-size:8px">${JSON.stringify(ret, null, 2)}</pre>
        </details>
      </div>
    </div>`)
        }

        function showInfo(str) {
            if (!str) {
                return document.getElementById('kpn-working')?.remove?.()
            }
            console.log('showing info:', str)
            getTargetElement().insertAdjacentHTML('afterEnd', `
    <div id="kpn-working">
        <p class="mb-0 color-secondary text-xs">Zip: <b>${zipCode}</b>; HouseNumber: <b>${houseNumber}</b>; Ext: <b>${ext}</b></p>
        <p class="object-header__price" style="font-size: 1rem;white-space: initial;">${str || 'Fetching KPN Fiber Info...'}</p>
        <a class="m-0" onclick="main()">Re-try</a>
    </div>`)
        }

        async function getSpeed(accessToken, houseNumber, zipCode, ext) {
            console.log(`houseNumber, zipCode, ext`, houseNumber, zipCode, ext)
            return (new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    url: 'https://api-prd.kpn.com/network/kpn/internet-speed-check/offer',
                    method: 'POST',
                    headers:{
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        service_address: {
                            "house_number": Number(houseNumber),
                            "zip_code": zipCode,
                            "house_number_extension": ext
                        }
                    }),
                    onload: (r) => {
                        resolve(r.responseText)
                    }
                })
            })).then(text => JSON.parse(text))
        }

        async function getToken(){
            const tokenObj = localStorage.getItem(KPN_TOKEN_KEY)
            console.log("cached token", tokenObj)
            if (tokenObj) {
                console.log("use cached token")
                const obj = JSON.parse(tokenObj)
                const expireT = Number(obj.issued_at) / 1000 + Number(obj.expires_in)
                const tToExpire = expireT - new Date() / 1000
                console.log(tToExpire, "seconds to expire")
                if (tToExpire <= 60) {
                    console.log("cached token expired.")
                } else {
                    return JSON.parse(tokenObj)
                }
            }
            return (new Promise((resolve, reject) => {
                const data = new URLSearchParams({
                    client_id: "",
                    client_secret: ""
                })
                console.log('post data:', data, data.toString())
                GM_xmlhttpRequest({
                    url: 'https://api-prd.kpn.com/oauth/client_credential/accesstoken?grant_type=client_credentials',
                    method: 'POST',
                    headers:{
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data: data.toString(),
                    onload: (r) => {
                        console.log('response:', r.responseText)
                        resolve(r.responseText)
                    }
                })
            })).then(text => {
                console.log('text:', text)
                return JSON.parse(text)
            })
        }
    }

    const interval = setInterval(() => {
        console.log(document.readyState)
        if (document.readyState === 'complete') {
            actualFuction()
            clearInterval(interval)
        }
    }, 500)
})();
