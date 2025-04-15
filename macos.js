const puppeteer = require('puppeteer');
const readline = require('readline');

// Helper: ask user a yes/no question
async function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(query, () => {
        rl.close();
        resolve();
    }));
}

(async () => {
    const targetURL = 'https://ams.ashoka.edu.in/Contents/Evaluation/CourseEvaluationEntry.aspx'; // your URL here

    const browser = await puppeteer.launch({ 
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        userDataDir: '~/Library/Application Support/Google/Chrome'
    });
    const page = await browser.newPage();

    // Always ask the user to log in manually
    console.log('👤 Please log in manually.');
    await page.goto(targetURL, { waitUntil: 'networkidle2' });
    await askQuestion('👉 Press Enter after logging in...');
    await page.goto(targetURL, { waitUntil: 'domcontentloaded' });


    // Click "Click to fill" links until none remain
    let clickToFillLinksRemaining = true;

    while (clickToFillLinksRemaining) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds
        clickToFillLinksRemaining = await page.evaluate(() => {
            const links = document.querySelectorAll('a');
            let linkFound = false;

            // Look for the first "Click to fill" link and click it
            links.forEach(link => {
                if (link.textContent === 'Click to fill') {
                    linkFound = true;
                    link.click(); // Click to fill
                }
            });

            return linkFound;
        });

        if (clickToFillLinksRemaining) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds
            console.log('📝 Form opened. Filling out the form...');

            // Wait for the form to load after clicking the link
            await page.waitForSelector('form'); // Assuming a form is loaded, modify this selector if needed

            // Fill out the form (random data for now)
            await page.evaluate(() => {
                // For example, filling out textareas and selects
                document.querySelectorAll('textarea').forEach(t => {
                    t.value = "Random comment " + Math.random().toString(36).substring(2);
                    t.dispatchEvent(new Event('input', { bubbles: true }));
                });

                document.querySelectorAll('select').forEach(s => {
                    if (s.options.length > 1) {
                        let i = Math.floor(Math.random() * (s.options.length - 1)) + 1;
                        s.selectedIndex = i;
                        s.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            });

            // Submit the form (assuming there's a submit button)
            await page.evaluate(() => {
                const submitButton = document.querySelector('#btnSave'); // Adjusted selector for the button
                if (submitButton) {
                    submitButton.click();
                    console.log('✅ Form submitted.');
                }
            });

            // Wait for some indication that the form has been submitted or the page has updated
            // await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

            await page.goto(targetURL, { waitUntil: 'domcontentloaded' });

            // Store data in IndexedDB
            const indexedDBData = await page.evaluate(async () => {
                const result = {};
                const databases = await window.indexedDB.databases();

                const connect = (database) => new Promise(function (resolve, _) {
                    const request = window.indexedDB.open(database.name, database.version);
                    request.onsuccess = _ => resolve(request.result);
                });

                const getAll = (db, objectStoreName) => new Promise(function (resolve, _) {
                    const request = db.transaction([objectStoreName]).objectStore(objectStoreName).getAll();
                    request.onsuccess = _ => resolve(request.result);
                });

                for (let i = 0; i < databases.length; i++) {
                    const db = await connect(databases[i]);
                    const dbName = db.name;
                    result[dbName] = {};
                    for (let j = 0; j < db.objectStoreNames.length; j++) {
                        const objectStoreName = db.objectStoreNames[j];
                        result[dbName][objectStoreName] = [];
                        const values = await getAll(db, objectStoreName);
                        result[dbName][objectStoreName] = values;
                    }
                }
                return result;
            });

            console.log('📦 IndexedDB Data:', indexedDBData);
        }
    }

    console.log('🎉 All "Click to fill" links have been processed.');

    // Close the browser
    await browser.close();
})();
