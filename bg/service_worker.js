console.log("Service worker loaded!")

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.type === "getSteamFriends-bm-friendlist") {

        chrome.tabs.sendMessage(sender.tab.id, {
            type: "getSteamFriends-bm-friendlist-resolved",
        });
    }
})