// ==UserScript==
// @name         Funda KPN Fiber Check
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Get KPN Fiber status and Internet speed. You need your own KPN DEV access from https://developer.kpn.com/ . It's free tho.
// @author       Whoever
// @match        *://www.funda.nl/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=kpn.com
// @grant        GM_xmlhttpRequest
// @connect      api-prd.kpn.com
// ==/UserScript==

(async function() {
    'use strict';
    const KPN_TOKEN_KEY = "KPN_TOKEN_OBJ"
    const address = document.getElementsByClassName('object-header__title')?.[0]?.textContent
    if (!address) {
        console.log('can not parse address')
        return
    }
    const addressArr = address.split(/\s+/)
    let houseNumber = addressArr[addressArr.length - 1]
    let ext = ""
    if (!Number(houseNumber) || !isNaN(Number(addressArr[addressArr.length - 2]))) {
        ext = houseNumber
        houseNumber = addressArr[addressArr.length - 2]
    }
    const zipCode = document.getElementsByClassName('object-header__subtitle')?.[0]?.textContent?.split(/\s+/)?.slice(0, 2).join('')

    const {access_token} = await getToken()
    console.log(address)
    const ret = await getSpeed(access_token, houseNumber, zipCode, ext)
    console.log('ret:', ret)
    displaySpeed(ret)

    function displaySpeed(infoObj) {
        document.getElementsByClassName('object-header__pricing')[0].insertAdjacentHTML('afterEnd', `
    <div class="object-header__pricing fd-text-size-l fd-flex--bp-m fd-align-items-center" style="font-size: 1rem" id="kpn-info">
      <div>
        <p class="object-header__price" style="font-size: 1rem">KPN Fiber: ${infoObj.fixed_info.fiber_access ? '✅' : '❌'} | ⬇️ ${infoObj.bandwidth.down || '-'}Mbps / ⬆️ ${infoObj.bandwidth.up || '-'}Mbps</strong>
      </div>
    </div>

    <details>
      <summary>KPN Details</summary>
      <pre style="font-size:8px">${JSON.stringify(ret, null, 2)}</pre>
    </details>`)
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
        return fetch('https://api-prd.kpn.com/oauth/client_credential/accesstoken?grant_type=client_credentials', {
            method: 'POST',
            headers:{
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            // GET FREE API ACCESS FROM https://developer.kpn.com/
            body: new URLSearchParams({
                client_id: "YOUR_KPN_DEV_CLIENT_ID",
                client_secret: "YOUR_KPN_DEV_CLIENT_SEC"
            })
        }).then(res => res.json())
            .then(obj => {
            localStorage.setItem(KPN_TOKEN_KEY, JSON.stringify(obj))
            return obj
        })
    }
})();
