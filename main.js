console.log("EXTENSION: bm-friendlist loaded!")

let lastUrl = "";
let currentPlayerBmId = 0;

//Extension should fire/refresh on page change
window.addEventListener("load", () => checkIfPlayerPage(window.location.href))
navigation.addEventListener("navigate", (event) => {
    checkIfPlayerPage(event.destination.url);
});
//Extension should fire/refresh on page change

async function checkIfPlayerPage(url) {
    if (url === lastUrl) {
        lastUrl = url;
        currentPlayerBmId = 0;
        return;
    }
    let playerPage = url.includes("/rcon/players/");
    if (!playerPage) return //Not on a player page

    const urlArray = url.split("/");
    const currentPlayer = urlArray[urlArray.findIndex(item => item === "players") + 1];

    const identifiersPage = urlArray.length === 7 && urlArray.includes("identifiers")
    const overviewPage = urlArray.length === 6;
    if (!identifiersPage && !overviewPage) return; //Not on identifier or overview page

    if (currentPlayer == currentPlayerBmId) return; //Same player, different page, no need to reload
    currentPlayerBmId = currentPlayer;

    const { setup } = await import(chrome.runtime.getURL('./modules/setup.js'));
    setup()
}