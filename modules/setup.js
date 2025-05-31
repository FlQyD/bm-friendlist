export async function setup() {

    const steamId = 0;
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

    //GET FRIEND LIST AND DISPLAY IT
}