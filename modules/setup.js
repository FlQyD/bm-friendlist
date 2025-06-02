const steamApiKey = localStorage.getItem('BMF_STEAM_API_KEY');
const rustApiKey = localStorage.getItem("BMF_RUST_API_KEY");

export async function setup() {
    if (await checkValues()) return;
    

    let steamId = 0;
    for (let i = 0; steamId === 0 && i < 50; i++) {
        await new Promise(r => { setTimeout(() => { r() }, 100 + (i / 10 * 100)); })
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

    getPlayerData(steamId);
}

async function getPlayerData(steamId) {
    const steamFriends = await getSteamFriendList(steamId);
    const rawSteamFriendsIds = typeof(steamFriends) === "string" ? [] : steamFriends.map(item => item.steamId);
    let historicFriends = await getHistoricFriends(steamId);
    if (typeof (historicFriends) === "string") historicFriends = [];

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
        await new Promise((r) => { setTimeout(() => { r() }, 1000); })
    }

    const displaySteamFriends = [];
    const displayHistoricFriends = [];

    if (typeof (steamFriends) != "string") {
        steamFriends.forEach(friend => {
            const newSteamFriend = {}
            newSteamFriend.steamId = friend.steamId;
            newSteamFriend.since = friend.friendSince;

            newSteamFriend.name = friend.steamId;
            newSteamFriend.avatar = "unknown";
            newSteamFriend.banData = "N/A"

            const currentPlayerData = playerData.find(item => item.steamId === newSteamFriend.steamId);
            if (!currentPlayerData) return displaySteamFriends.push(newSteamFriend)

            newSteamFriend.name = currentPlayerData.name;
            newSteamFriend.avatar = currentPlayerData.avatar;
            newSteamFriend.banData = currentPlayerData.banData;

            displaySteamFriends.push(newSteamFriend);
        })
    }

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

    const { showFriends } = await import(chrome.runtime.getURL('./modules/display.js'));
    showFriends(displaySteamFriends, displayHistoricFriends);
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
    return playerData;

}
async function getSteamFriendList(steamId) {
    if (!steamApiKey) return "ERROR";

    let waiting = true;
    let friendlist = [];
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.type !== "bm-friendlist-getSteamFriendListResolved") return;

        friendlist = request.friendlist;
        waiting = false;
    })
    chrome.runtime.sendMessage({ type: "bm-friendlist-getSteamFriendList", steamId: steamId, apiKey: steamApiKey });

    while (waiting) await new Promise(resolve => setTimeout(resolve, 100));
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
    return friendlist;
}

async function checkValues() {
    if (!steamApiKey && !rustApiKey) {
        const { printSidebar } = await import(chrome.runtime.getURL('./modules/settings.js'));
        printSidebar();
        return true;
    }

    const color = localStorage.getItem("bmf-colors");
    console.log(color);
    
    if (!color) {
        localStorage.setItem("bmf-colors",
            JSON.stringify(
                {
                    seenOnOrigin: "#00332f",
                    seenOnFriend: "#292300"
                }
            )
        )
    }
    return false;
}