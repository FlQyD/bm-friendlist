const steamApiKey = localStorage.getItem('BMF_STEAM_API_KEY');
const rustApiKey = localStorage.getItem("BMF_RUST_API_KEY");

export async function setup(bmId) {
    if (await checkValues()) return;

    let steamId = 0;
    for (let i = 0; steamId === 0 && i < 50; i++) {
        await new Promise(r => { setTimeout(() => { r() }, 100 + (i / 10 * 100)); })
        const onTheRightPage = await checkIfStillOnTheRightPage(bmId);
        if (!onTheRightPage) return; //Not on the right player page or on a player page at all.
        
        const items = document.getElementsByClassName("css-8uhtka");

        if (items.length === 0) continue;

        for (const item of items) {
            const title = item.title;

            if (!title) continue;
            if (isNaN(Number(title))) continue;
            if (!title.startsWith("7656")) continue;
            if (title.length != 17) continue;

            steamId = title;
        }
    }

    if (steamId === 0) {
        console.error("STEAM ID wasn't found on the site.")
        return;
    }

    const onTheRightPage = checkIfStillOnTheRightPage(bmId);
    if (!onTheRightPage) return;

    getPlayerData(steamId, bmId);
}

async function getPlayerData(steamId, bmId) {
    let steamFriends = await getSteamFriendList(steamId);
    let steamFriendsStatus = "";
    
    if (steamFriends === "Private") {
        steamFriends = [];
        steamFriendsStatus = "Private";
    }
    
    const rawSteamFriendsIds = steamFriends.map(item => item.steamId);
    let historicFriends = await getHistoricFriends(steamId);

    const realHistoricFriends = [];
    historicFriends.forEach(friend => {
        if (rawSteamFriendsIds.includes(friend.steamId)) return;
        realHistoricFriends.push(friend)
    })

    const currentSteamIds = [...rawSteamFriendsIds];
    realHistoricFriends.forEach(friend => {
        currentSteamIds.push(friend.steamId);
    })

    const playerData = [];

    const chunkSize = 100;
    for (let i = 0; i < currentSteamIds.length; i += chunkSize) {
        const chunk = currentSteamIds.slice(i, i + chunkSize);

        const chunkData = await requestPlayerData(chunk);
        if (chunkData == "Error") continue;

        playerData.push(...chunkData)
        await new Promise((r) => { setTimeout(() => { r() }, 500); })
    }

    const displaySteamFriends = [];
    const displayHistoricFriends = [];

    steamFriends.forEach(friend => {
        const newSteamFriend = {
            steamId: friend.steamId,
            since: friend.friendSince,
            name: friend.steamId,
            avatar: "unknown",
            banData: "N/A"
        }

        const currentPlayerData = playerData.find(item => item.steamId === newSteamFriend.steamId);
        if (!currentPlayerData) return displaySteamFriends.push(newSteamFriend)

        newSteamFriend.name = currentPlayerData.name;
        newSteamFriend.avatar = currentPlayerData.avatar;
        newSteamFriend.banData = currentPlayerData.banData;

        displaySteamFriends.push(newSteamFriend);
    })


    realHistoricFriends.forEach(friend => {
        const newHistoricFriend = {};
        newHistoricFriend.name = friend.steamId;
        newHistoricFriend.steamId = friend.steamId;
        newHistoricFriend.firstSeen = friend.firstSeen;
        newHistoricFriend.lastSeen = friend.lastSeen;
        newHistoricFriend.origin = friend.origin;
        newHistoricFriend.banData = "N/A";
        newHistoricFriend.avatar = "unknown";

        const currentPlayerData = playerData.find(item => item.steamId === newHistoricFriend.steamId);
        if (!currentPlayerData) return displayHistoricFriends.push(newHistoricFriend)

        newHistoricFriend.name = currentPlayerData.name;
        newHistoricFriend.avatar = currentPlayerData.avatar;
        newHistoricFriend.banData = currentPlayerData.banData;

        displayHistoricFriends.push(newHistoricFriend)
    })
    
    const onTheRightPage = checkIfStillOnTheRightPage(bmId);
    if (!onTheRightPage) return;

    const { showFriends } = await import(chrome.runtime.getURL('./modules/display.js'));
    showFriends(displaySteamFriends, steamFriendsStatus, displayHistoricFriends);
}
async function requestPlayerData(steamIds) {
    if (!steamApiKey) return "Error";

    let waiting = true;
    let playerData = [];
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.type !== "bm-friendlist-getSteamPlayerDataResolved") return;

        playerData = request.playerData;
        waiting = false;
    })
    chrome.runtime.sendMessage({ type: "bm-friendlist-getSteamPlayerData", steamIds: steamIds, apiKey: steamApiKey });

    while (waiting) await new Promise(resolve => setTimeout(resolve, 100));
    if (typeof(playerData) === "string") return [];
    return playerData;
}
async function getSteamFriendList(steamId) {
    if (!steamApiKey) return [];

    let waiting = true;
    let friendlist = [];
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.type !== "bm-friendlist-getSteamFriendListResolved") return;

        friendlist = request.friendlist;
        waiting = false;
    })
    chrome.runtime.sendMessage({ type: "bm-friendlist-getSteamFriendList", steamId: steamId, apiKey: steamApiKey });

    while (waiting) await new Promise(resolve => setTimeout(resolve, 100));
    if (friendlist === "Private") return friendlist;
    if (typeof (friendlist) === "string") return [];
    return friendlist;
}
async function getHistoricFriends(steamId) {
    if (!rustApiKey) return "Error"

    let waiting = true;
    let friendlist = [];
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.type !== "bm-friendlist-getHistoricFriendListResolved") return;

        friendlist = request.friendlist;
        waiting = false;
    })
    chrome.runtime.sendMessage({ type: "bm-friendlist-getHistoricFriendList", steamId: steamId, apiKey: rustApiKey });

    while (waiting) await new Promise(resolve => setTimeout(resolve, 100));
    if (typeof (friendlist) === "string") return [];
    return friendlist;
}
async function checkValues() {
    if (!steamApiKey && !rustApiKey) {
        const { printSidebar } = await import(chrome.runtime.getURL('./modules/settings.js'));
        printSidebar();
        return true;
    }

    const color = localStorage.getItem("bmf-colors");

    if (!color) {
        localStorage.setItem("bmf-colors",
            JSON.stringify(
                {
                    seenOnOrigin: "#00aaff10",
                    seenOnFriend: "#ae6a3d10"
                }
            )
        )
    } 
    return false;
}
async function checkIfStillOnTheRightPage(staticBmId) {
    const url = window.location.href;
    const urlArray = url.split("/")
    
    const bmId = urlArray[5];
    if (!bmId) return false;
    if (isNaN(Number(bmId))) return false;

    if (bmId !== staticBmId) return false;

    const isOverview = urlArray.length === 6;
    const isIdentifiers = urlArray.length === 7 && urlArray[6] === "identifiers";

    if (!isIdentifiers && !isOverview) return false;

    return true;
}