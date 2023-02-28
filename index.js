const concurrentRequests = 8;
const urls = [
    `https://www.lycamobile.co.uk/ucustomer/mse-[VALUE]`,
    `https://www.lycamobile.co.uk/ucustomer/mse-[VALUE]gb`,
    `https://www.lycamobile.co.uk/ucustomer/uswitch-[VALUE]gb/`,
    `https://www.lycamobile.co.uk/ucustomer/uswitch-[VALUE]`];

const iterations = 20;
const elements = {
    progress: document.querySelector("#progress"),
    progressBar: document.querySelector("#progress").querySelectorAll(".progress-bar")[0],
    list: document.querySelector("#list"),
    table: document.querySelector("#table"),
    button: document.querySelector("#run"),
};
const offers = {};
const table = new Tabulator("#table", {
    data: [],
    layout: "fitColumns",
    columns: [
        { title: "Offer Price", field: "offerPrice", },
        { title: "Normal Price", field: "price", },
        { title: "Data (GB)", field: "data" },
        {
            title: "Link", field: "url", formatter: "link", formatterParams: {
                target: "_blank",
                labelField: "name"
            }
        },
        { title: "Offer Period", field: "offerPeriod", },
        { title: "Name", field: "name", visible: false }
    ],
});

function toggleProgressBar() {
    toggleDisplay(elements.progress, 'flex');
}

function toggleTable() {
    toggleDisplay(elements.table, 'block');
}

function toggleButton() {
    toggleDisplay(elements.button, 'block');
}

function toggleDisplay(element, displayValue) {
    element.style.display = element.style.display == 'none' ? displayValue : 'none';
}

function toggleProgressBarAnimation() {
    var klass = "progress-bar-animated";
    if (elements.progressBar.classList.contains(klass)) {
        elements.progressBar.classList.remove(klass);
    } else {
        elements.progressBar.classList.add(klass);
    }
}

function setProgressPercent(percent) {
    elements.progressBar.style.width = `${percent}%`;
}

function incrementProgress(step) {
    let percent = parseFloat(elements.progressBar.style.width.replace("%", ""));
    percent = isNaN(percent) ? 0 : percent;
    percent += step;
    elements.progressBar.style.width = `${percent}%`;
}

function appendRow(result) {
    let row = [{
        offerPrice: result.offerPrice,
        price: result.price,
        data: result.data,
        url: result.url,
        name: result.name,
        offerPeriod: result.offerPeriod
    }];

    table.addData(row);
}

let lock = false;
async function Run() {
    if (lock) {
        return;
    }

    lock = true;

    toggleButton();
    toggleProgressBarAnimation();
    toggleProgressBar();
    toggleTable();
    var toScan = [];
    for (let i = 0; i < urls.length; i++) {
        toScan = toScan.concat(GetUrls(urls[i]));
    }

    let totalToScan = toScan.length;
    let step = 1 / totalToScan * 100;
    let i = 0;
    let complete = false;
    while (!complete) {
        let start = concurrentRequests * i
        let end = start + concurrentRequests;
        let batch = toScan.slice(start, end);

        await Promise.allSettled(batch.map(async url => {
            incrementProgress(step);
            let data = await FetchData(url);
            console.log(data);
        }));

        complete = end >= totalToScan;
        i++;
    }

    toggleProgressBar();
    toggleButton();

    lock = false;
}

async function FetchData(url) {
    let response = await fetch(url);

    if (!response.ok) {
        return Promise.reject();
    }

    if (offers[response.url]) {
        return Promise.reject("URL Handled");
    }

    let text = await response.text();

    var body = new DOMParser().parseFromString(text, 'text/html');
    var offer = body.querySelectorAll(".value-proposition-container");
    var price = offer[0].querySelectorAll(".ex-price")[0].textContent;
    var offerPrice = offer[0].querySelectorAll(".bold-text-2.light-us")[0].textContent;
    var dataAllowancesText = offer[0].querySelectorAll(".big-text")[0].textContent;
    var dataAllowanceMatches = dataAllowancesText.match(/\d+GB/g);
    var totalDataAllowance = 0;

    for (let i = 0; i < dataAllowanceMatches.length; i++) {
        let x = parseInt(dataAllowanceMatches[i].match(/\d+/g)[0]);
        totalDataAllowance += x;
    }

    var terms = offer[0].querySelectorAll(".short-paragraph")[0].textContent;
    var offerPeriod = terms.match(/\d+\smonths/g)[0];
    var name = body.title.split(" - ")[0]
    var result = {
        url: response.url,
        data: totalDataAllowance,
        dataText: dataAllowancesText, dataText: dataAllowancesText,
        price: price,
        offerPrice: offerPrice,
        name: name,
        terms: terms,
        offerPeriod: offerPeriod
    };

    offers[response.url] = result;
    appendRow(result);
    return result;
}

function GetUrls(baseUrl) {
    var results = [];
    for (let i = 0; i < iterations; i++) {
        var url = baseUrl.replace("[VALUE]", i);
        results.push(url)
    }
    return results;
}