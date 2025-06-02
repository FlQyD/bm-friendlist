console.log("Service worker loaded!")

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.type === "bm-friendlist-getSteamFriendList") {
        try {
            const STEAM_API_KEY = request.apiKey;
            const steamId = request.steamId;

            if (steamId.length != 17) throw new Error("Not 17 character long.")
            if (isNaN(Number(steamId))) throw new Error("Not a number.");
            

            const resp = await fetch(`https://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&relationship=friend`);
            if (resp.status !== 200) throw new Error("Error while fetching, code: " + resp.status);

            const data = await resp.json();

            const steamFriends = data.friendslist.friends.map(item => {
                return {
                    friendSince: item.friend_since,
                    steamId: item.steamid
                }
            })
            return chrome.tabs.sendMessage(sender.tab.id, {
                type: "bm-friendlist-getSteamFriendListResolved",
                friendlist: steamFriends
            });
        } catch (error) {
            console.error(error);
            return chrome.tabs.sendMessage(sender.tab.id, {
                type: "bm-friendlist-getSteamFriendListResolved",
                friendlist: "Error"
            });
        }
    } else if (request.type === "bm-friendlist-getHistoricFriendList") {
        try {
            const API_KEY = request.apiKey;
            const steamId = request.steamId;

            const resp = await fetch(`https://rust-api.flqyd.dev/steamFriends/${steamId}?accessToken=${API_KEY}`);
            if (resp.status !== 200) throw new Error("Error while fetching friends, code: " + resp.status);

            const data = await resp.json();
            return chrome.tabs.sendMessage(sender.tab.id, {
                type: "bm-friendlist-getHistoricFriendListResolved",
                friendlist: data.data.friends
            });
        } catch (error) {
            console.error(error);
            return chrome.tabs.sendMessage(sender.tab.id, {
                type: "bm-friendlist-getHistoricFriendListResolved",
                friendlist: "Error"
            });
        }
    } else if (request.type === "bm-friendlist-getSteamPlayerData") {
        try {
            const API_KEY = request.apiKey;
            const steamIds = request.steamIds;

            const playerData = await requestSteamPlayerSummaries(steamIds, API_KEY)            
            if (playerData === "Rate Limit") throw new Error("Rate Limit");

            await new Promise(r => {setTimeout(() => {r()}, 1000)})
            const banData = await requestBanData(steamIds, API_KEY)

            const combinedData = [];
            playerData.forEach(item => {
                const player = {
                    name: item.personaname,
                    steamId: item.steamid,
                    avatar: item.avatarhash,
                    banData: {}
                }
                
                if (typeof(banData) == "string") {
                    player.banData = "N/A"
                    return combinedData.push(player);
                }
                
                const banDataItem = banData.find(item => item.SteamId === player.steamId);
                player.banData.vacBans = banDataItem.NumberOfVACBans;
                player.banData.gameBans = banDataItem.NumberOfGameBans;
                player.banData.daysSinceLast = banDataItem.DaysSinceLastBan;

                combinedData.push(player)
            });
            return chrome.tabs.sendMessage(sender.tab.id, {
                type: "bm-friendlist-getSteamPlayerDataResolved",
                playerData: combinedData
            });
        } catch (error) {
            console.error(error);
            return chrome.tabs.sendMessage(sender.tab.id, {
                type: "bm-friendlist-getSteamPlayerDataResolved",
                playerData: "Error"
            });
        }
    }
})



async function requestSteamPlayerSummaries(steamIds, API_KEY, count = 0) {
    if (count > 1) return "ERROR";
    try {
        const resp = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${API_KEY}&steamids=${steamIds.join(",")}`);
        if (resp.status === 429) throw new Error("Rate Limit")
        if (resp.status !== 200) throw new Error("Error while fetching, code: " + resp.status);
        
        const data = await resp.json();        
        return data.response.players;
    } catch (error) {
        console.error(error);
        if (error.message === "Rate Limit") return "Rate Limit";
        await new Promise(r => {setTimeout(() => {r()}, 1000)})
        return requestSteamPlayerSummaries(steamIds, API_KEY, count+1);
    }
}
async function requestBanData(steamIds, API_KEY, count = 0) {
    if (count > 1) return "ERROR";
    try {
        const resp = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${API_KEY}&steamids=${steamIds.join(",")}`);
        if (resp.status === 429) throw new Error("Rate Limit")
        if (resp.status !== 200) throw new Error("Error while fetching, code: " + resp.status);

        const data = await resp.json();
        return data.players;
    } catch (error) {
        console.error(error);
        if (error.message === "Rate Limit") return [];
        await new Promise(r => {setTimeout(() => {r()}, 1000)})
        return requestBanData(steamIds, API_KEY, count + 1);
    }

}