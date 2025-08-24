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
    let [steamFriends, historicFriends, teaminfo] = await Promise.all([
        getSteamFriendList(steamId),
        getHistoricFriends(steamId),
        getTeaminfo(bmId, steamId)
    ]);


    let steamFriendsStatus = "";

    if (steamFriends === "Private") {
        steamFriends = [];
        steamFriendsStatus = "Private";
    }

    const rawSteamFriendsIds = steamFriends.map(item => item.steamId);

    const realHistoricFriends = [];
    historicFriends.forEach(friend => {
        if (rawSteamFriendsIds.includes(friend.steamId)) return;
        realHistoricFriends.push(friend)
    })

    const currentSteamIds = [...rawSteamFriendsIds];
    realHistoricFriends.forEach(friend => {
        currentSteamIds.push(friend.steamId);
    })
    if (typeof (teaminfo) !== "string") {
        teaminfo.members.forEach(teammate => {
            if (!currentSteamIds.includes(teammate)) currentSteamIds.push(teammate)
        })
    }

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

    if (typeof (teaminfo) !== "string")
        teaminfo.members = teaminfo.members.map(member => {
            const playerInfo = {
                steamId: member,
                name: member,
                avatar: "unknown",
                banData: "N/A"
            }

            const currentPlayerData = playerData.find(item => item.steamId === member);
            if (!currentPlayerData) return playerInfo;

            playerInfo.name = currentPlayerData.name;
            playerInfo.avatar = currentPlayerData.avatar;
            playerInfo.banData = currentPlayerData.banData;
            return playerInfo
        })

    realHistoricFriends.forEach(friend => {
        const newHistoricFriend = {};
        newHistoricFriend.name = friend.steamId;
        newHistoricFriend.steamId = friend.steamId;
        newHistoricFriend.firstSeen = friend.firstSeen;
        newHistoricFriend.lastSeen = friend.lastSeen;
        newHistoricFriend.since = friend.since;
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

    const { showFriends, showTeamMembers } = await import(chrome.runtime.getURL('./modules/display.js'));
    showFriends(displaySteamFriends, steamFriendsStatus, displayHistoricFriends);
    showTeamMembers(teaminfo)
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
    if (typeof (playerData) === "string") return [];
    return playerData;
}
export async function getSteamFriendList(steamId) {
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
export async function getHistoricFriends(steamId) {
    if (!rustApiKey) return [];

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


async function getTeaminfo(bmId, steamId) {
    const element = document.getElementById("oauthToken");

    const authToken = element && element.innerText ? element.innerText : "";
    if (!authToken) return "error";

    const lastServer = await getLastServer(bmId, authToken);
    if (!lastServer) return "error"

    console.log(lastServer);


    let teaminfoString = "";
    //BattleZone
    if (lastServer.orgId === "29251") teaminfoString = await getBzTeamInfo(steamId, lastServer.id, authToken)
    //BestRust
    if (lastServer.orgId === "18611") teaminfoString = await getBrTeamInfo(steamId, lastServer.id, authToken);
    if (!teaminfoString || teaminfoString === "error") return { teamId: "error", members: [], server: lastServer.name, raw: teaminfoString }



    if (teaminfoString === "error") return "error";
    if (teaminfoString === "Player is not in a team" || teaminfoString === "Player not found") {
        return { teamId: "error", members: [], server: lastServer.name, raw: teaminfoString }
    }

    const teamMembers = [];
    let teamId = -1;
    teaminfoString.split("\n").forEach(line => {
        if (line.length < 10 && line.includes("ID: ")) teamId = line.split(" ")[1];
        if (!line.includes("76561")) return;

        teamMembers.push(line.substring(0, 17));
    })

    const teamInfo = {};
    teamInfo.teamId = teamId;
    teamInfo.members = teamMembers;
    teamInfo.server = lastServer.name;
    return teamInfo
}

async function getLastServer(bmId, authToken) {
    const myServers = await getMyServers(authToken);

    const resp = await fetch(`https://api.battlemetrics.com/players/${bmId}?version=^0.1.0&include=server&filter[servers]=${myServers.join(",")}&access_token=${authToken}`);
    if (resp.status !== 200) {
        console.error(`Failed to get recent server | Status: ${resp?.status}`);
        return null;
    }

    const data = await resp.json();
    const servers = data.included
        .filter(item => item.type === "server")
        .map(server => {
            return {
                name: server.attributes?.name,
                id: server.id,
                orgId: server.relationships.organization.data.id,
                lastPlayed: new Date(server.meta.lastSeen).getTime()
            }
        })
        .sort((a, b) => b.lastPlayed - a.lastPlayed);

    const lastServer = servers[0];

    if (!lastServer) return null;
    if (Date.now() - 2 * 24 * 60 * 60 * 1000 > lastServer.lastPlayed) return null;

    return lastServer
}
async function getMyServers(authToken) {
    let myServers = JSON.parse(localStorage.getItem("BMF_SERVER_CACHE"));
    if (myServers && myServers.timestamp > Date.now() - 24 * 60 * 60 * 1000) return myServers.servers;

    const resp = await fetch(`https://api.battlemetrics.com/servers?version=^0.1.0&filter[rcon]=true&page[size]=100&access_token=${authToken}`)
    if (resp?.status !== 200) {
        console.error(`Failed to request your servers | Status: ${resp?.status}`);
        return null;
    }

    const data = await resp.json();
    myServers = {
        timestamp: Date.now(),
        servers: data.data.map(server => server.id)
    }
    localStorage.setItem("BMF_SERVER_CACHE", JSON.stringify(myServers))

    return myServers.servers;
}
async function getBzTeamInfo(steamId, serverId, authToken) {
    const resp = await fetch(`https://api.battlemetrics.com/servers/${serverId}/command`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${authToken}`,
            "Content-Type": "application/json",
            "Accept-Version": "^0.1.0"
        },
        body: JSON.stringify({
            data: {
                type: "rconCommand",
                attributes: {
                    command: "raw",
                    options: {
                        raw: `teaminfo ${steamId}`
                    }
                }
            }
        })
    })

    if (resp.status !== 200) {
        console.error(`Failed to request teaminfo | Status: ${resp.status}`);
        return "error";
    }

    const data = await resp.json();
    const result = data.data?.attributes?.result
    if (!result) {
        console.error(`Failed to request teaminfo | Status: ${resp.status} | Result: ${result}`);
        return "error";
    }

    return result;
}
async function getBrTeamInfo(steamId, serverId, authToken) {
    const resp = await fetch(`https://api.battlemetrics.com/servers/${serverId}/command`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${authToken}`,
            "Content-Type": "application/json",
            "Accept-Version": "^0.1.0"
        },
        body: JSON.stringify({
            data: {
                type: "rconCommand",
                attributes: {
                    command: "edb0be86-6f5e-4e4b-a655-5fcecd4af11f",
                    options: {
                        command: "teaminfo",
                        steamid: steamId,
                        format: " "
                    }
                }
            }
        })
    })

    if (resp.status !== 200) {
        console.error(`Failed to request teaminfo | Status: ${resp.status}`);
        return "error";
    }

    const data = await resp.json();
    
    const result = data.data?.attributes?.result[0]?.children[1]?.children[0]?.children[0]?.reference.result
    if (!result) {
        console.error(`Failed to request teaminfo | Status: ${resp.status} | Result: ${result}`);
        return "error";
    }

    return result;
}