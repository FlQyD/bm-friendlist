const color = JSON.parse(localStorage.getItem("bmf-colors"));

export async function showFriends(steamFriends, steamFriendsStatus, historicFriends) {
    steamFriends = steamFriends.sort((a, b) => b.since - a.since);
    historicFriends = historicFriends.sort((a, b) => b.firstSeen - a.firstSeen);

    const main = document.getElementById("RCONContainer");
    const container = getContainer();
    main.appendChild(container);

    const steamFriendsElement = getSteamFriendsElement(steamFriends, steamFriendsStatus);
    container.appendChild(steamFriendsElement);

    const historicFriendsElement = getHistoricFriendElement(historicFriends);
    container.appendChild(historicFriendsElement);
}

function getContainer() {
    const container = document.createElement("div")
    container.id = "friends-container"

    return container;
}

function getSteamFriendsElement(steamFriends, steamFriendsStatus) {    
    const container = document.createElement("div");
    container.classList.add("friend-section")

    const titleDiv = document.createElement("div");
    titleDiv.classList.add("friend-title")
    container.appendChild(titleDiv);

    const title = document.createElement("h2");
    title.innerText = `Steam Friends(${steamFriendsStatus === "Private" ? steamFriendsStatus : steamFriends.length}):`
    titleDiv.appendChild(title);

    const settings = document.createElement("img");
    settings.src = chrome.runtime.getURL('images/settings.png');
    settings.addEventListener("click", async () => {
        const { printSettings } = await import(chrome.runtime.getURL('./modules/settings.js'));
        printSettings();
    })
    titleDiv.appendChild(settings);

    steamFriends.forEach(friend => {
        const friendElement = createFriendElement(friend);
        container.appendChild(friendElement);
    });

    return container;
}

function getHistoricFriendElement(historicFriends) {
    const container = document.createElement("div");
    container.classList.add("friend-section")

    const title = document.createElement("h2");
    title.innerText = `Historic Friends(${historicFriends.length}):`
    container.appendChild(title);

    historicFriends.forEach(friend => {
        const friendElement = createFriendElement(friend);
        container.appendChild(friendElement);
    });

    return container;
}

function createFriendElement(friend) {
    const container = document.createElement("div");
    if (friend.origin && friend.origin === "origin") container.style.background = color.seenOnOrigin;
    if (friend.origin && friend.origin === "friend") container.style.background = color.seenOnFriend;
    container.classList.add("friend-container");

    const avatar = document.createElement("img");
    avatar.src = friend.avatar === "unknown" ? chrome.runtime.getURL('images/unknown.png') : `https://avatars.cloudflare.steamstatic.com/${friend.avatar}_full.jpg`
    container.appendChild(avatar);

    const details = document.createElement("div");
    details.classList.add("friend-details")
    container.appendChild(details);

    const name = document.createElement("a");
    name.href = `https://steamcommunity.com/profiles/${friend.steamId}`;
    name.target = "_blank";
    name.innerText = friend.name;
    details.appendChild(name);

    if (friend.since) {
        const since = friend.since * 1000;

        const sinceElement = document.createElement("p");
        sinceElement.innerText = `Since: ${new Date(since).toISOString().substring(0, 10).replaceAll("-", ". ") + "."} (${Math.floor((Date.now() - since) / (24 * 60 * 60 * 1000))} days)`;
        details.appendChild(sinceElement)
    }

    if (friend.firstSeen) {
        const firstSeen = friend.firstSeen * 1000;

        const firstSeenElement = document.createElement("p");
        firstSeenElement.innerText = `First Seen: ${new Date(firstSeen).toISOString().substring(0, 10).replaceAll("-", ". ") + "."} (${Math.floor((Date.now() - firstSeen) / (24 * 60 * 60 * 1000))} days)`
        details.appendChild(firstSeenElement);
    }
    if (friend.lastSeen) {
        const lastSeen = friend.lastSeen * 1000;

        const lastSeenElement = document.createElement("p");
        lastSeenElement.innerText = `Last Seen: ${new Date(lastSeen).toISOString().substring(0, 10).replaceAll("-", ". ") + "."} (${Math.floor((Date.now() - lastSeen) / (24 * 60 * 60 * 1000))} days)`
        details.appendChild(lastSeenElement);
    }

    const banData = getBanData(friend.banData);
    container.appendChild(banData);

    return container;
}

function getBanData(banData) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("ban-data-wrapper");

    const inner = document.createElement("div");
    inner.classList.add("ban-data-inner");

    const container = document.createElement("div");
    container.classList.add("ban-data");

    let iconSrc;
    let colorClass;

    if (banData === "N/A") {
        colorClass = "gray";
        iconSrc = 'images/noSignal.png';
    } else if (banData.gameBans === 0 && banData.vacBans === 0) {
        colorClass = "green";
        iconSrc = 'images/check.png';
    } else {
        colorClass = "red";
        iconSrc = 'images/danger.png';
    }

    container.classList.add(colorClass);

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL(iconSrc);
    container.appendChild(img);

    inner.appendChild(container);

    if (colorClass === "red") {
        const banDetails = document.createElement("div");
        banDetails.classList.add("ban-details");

        const firstLine = document.createElement("p")
        const words = [];
        if (banData.vacBans) words.push(`${banData.vacBans} VAC`)
        if (banData.gameBans) words.push(`${banData.gameBans} Game`)
        firstLine.innerText = `${words.join(", ")} ban on record`;
        banDetails.appendChild(firstLine);

        const secondLine = document.createElement("p");
        secondLine.innerText = `${banData.daysSinceLast} days since last.`
        banDetails.appendChild(secondLine)

        inner.appendChild(banDetails);
    }

    wrapper.appendChild(inner);
    return wrapper;
}
