"use strict";

const header = document.querySelector(".site-header");
const navigation = document.querySelector("#hovedmenu");
const dropdowns = Array.from(header.querySelectorAll(".dropdown"));
const desktopHover = matchMedia("(min-width: 1200px) and (any-hover: hover)");
let hoverPreview = null;

function hideDropdown(toggle) {
    bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
}

// Bootstrap manages clicks, keyboard navigation and clicks outside the menu.
dropdowns.forEach((dropdown) => {
    const toggle = dropdown.querySelector(".dropdown-toggle");

    dropdown.addEventListener("pointerenter", (event) => {
        if (!desktopHover.matches || event.pointerType !== "mouse" || toggle.classList.contains("show")) {
            return;
        }

        const previouslyFocused = document.activeElement;
        const focusedMenu = previouslyFocused.closest(".dropdown-menu.show");
        if (focusedMenu && !dropdown.contains(focusedMenu)) return;

        header.querySelectorAll(".dropdown-toggle.show").forEach(hideDropdown);
        bootstrap.Dropdown.getOrCreateInstance(toggle).show();
        if (previouslyFocused === document.body) {
            toggle.blur();
        } else {
            previouslyFocused.focus({ preventScroll: true });
        }
        hoverPreview = toggle;
    });

    dropdown.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "mouse" && hoverPreview === toggle &&
            !dropdown.querySelector(".dropdown-menu").contains(document.activeElement)) {
            hideDropdown(toggle);
        }
    });

    dropdown.addEventListener("focusout", (event) => {
        if (hoverPreview === toggle && !dropdown.contains(event.relatedTarget) && !dropdown.matches(":hover")) {
            hideDropdown(toggle);
        }
    });

    toggle.addEventListener("hidden.bs.dropdown", () => {
        if (hoverPreview === toggle) hoverPreview = null;
    });
});

// A click on a preview keeps it open until the next click or dismissal.
window.addEventListener("click", (event) => {
    if (event.detail > 0 && hoverPreview && hoverPreview.contains(event.target)) {
        event.stopPropagation();
        hoverPreview.focus();
        hoverPreview = null;
    }
}, true);

navigation.addEventListener("hide.bs.collapse", () => {
    header.querySelectorAll(".dropdown-toggle.show").forEach(hideDropdown);
});

const searchForm = document.querySelector(".site-search");
const searchInput = searchForm.querySelector("input");
const searchResults = document.querySelector("#soegeresultater");
const searchStatus = searchResults.querySelector('[role="status"]');
const resultsList = searchResults.querySelector("ul");
let searchIndex;
let searchRequest = 0;

const localSummaries = {
    "forside.html": "Næste udstilling, DMJU by night, Dansk Model Jernbane Union, modeltog, fællesskab, Modelbanedag, DMJU Sneland, Åbent hus.",
    "velkommen.html": "Medlem, tilmelding, modeltoge, klubber, postnummer, adresse, email, telefonnummer, kontaktperson og nyhedsbrev.",
    "udstillinger.html": "Modelbanedag, DMJU Sneland og Åbent hus. Se modelbaner i drift og mød klubberne bag dem.",
    "nyheder.html": "En snak om modeltog, en by fuld af små detaljer, modelbaner fylder hallen, modeltog under åben himmel.",
    "hjaelpogviden.html": "Bestil dit OK Kort, OK El, kontakt, Willy Nielsen, MobilePay, støtte til klubber og ansøgning.",
    "omdmju.html": "Historien bag Dansk Model Jernbane Union. Poul Erik Clausen, Poul Erik Harby, James Steffensen, MOROP og modeljernbaneklubber.",
    "fotokonkurrence.html": "Fotokonkurrencen 2025, Under broen, Steen Svendsen, Henning Hansen, Odense Model Jernbane Klub og Farum Model Jernbane Klub."
};

function normalize(value) {
    return value.normalize("NFC").toLocaleLowerCase("da-DK");
}

function indexPage(main, page) {
    const blocks = Array.from(main.querySelectorAll("h1, h2, h3, p, label, time, section li"))
        .filter((element) => !element.closest(".modal"))
        .map((element) => element.textContent.replace(/\s+/g, " ").trim())
        .filter(Boolean);

    return { ...page, blocks, searchable: normalize([page.title, ...blocks].join(" ")) };
}

function getSearchIndex() {
    if (searchIndex) return searchIndex;

    const links = header.querySelectorAll(".navbar-brand, .dropdown-menu a");
    const pages = Array.from(links, (link) => ({
        href: link.getAttribute("href"),
        title: link.classList.contains("navbar-brand") ? "Forsiden" : link.textContent.trim()
    }));

    searchIndex = Promise.all(pages.map(async (page) => {
        const url = new URL(page.href, location.href);

        if (location.pathname === url.pathname) {
            return indexPage(document.querySelector("main"), page);
        }

        if (location.protocol !== "file:") {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error("Siden kunne ikke indlæses");
                const parsed = new DOMParser().parseFromString(await response.text(), "text/html");
                return indexPage(parsed.querySelector("main"), page);
            } catch {
                // The local descriptions still work when a page cannot be read.
            }
        }

        const description = localSummaries[page.href] || page.title;
        return { ...page, blocks: [description], searchable: normalize(page.title + " " + description) };
    }));
    return searchIndex;
}

searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return;

    const request = ++searchRequest;
    searchResults.hidden = false;
    resultsList.replaceChildren();
    searchStatus.textContent = "Søger…";

    const pages = await getSearchIndex();
    if (request !== searchRequest) return;

    const matchingPages = pages.filter((page) => words.every((word) => page.searchable.includes(word)));
    matchingPages.sort((a, b) => {
        const titleHits = (page) => words.filter((word) => normalize(page.title).includes(word)).length;
        return titleHits(b) - titleHits(a);
    });

    searchStatus.textContent = matchingPages.length
        ? `${matchingPages.length} ${matchingPages.length === 1 ? "resultat" : "resultater"} for “${query}”`
        : `Ingen resultater for “${query}”.`;

    matchingPages.forEach((page) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        const snippet = page.blocks.find((block) => block.length > 24 && words.some((word) => normalize(block).includes(word)));
        link.href = page.href;
        link.textContent = page.title;
        item.append(link);
        if (snippet) {
            const description = document.createElement("small");
            description.textContent = snippet.length > 145 ? snippet.slice(0, 142) + "…" : snippet;
            item.append(description);
        }
        resultsList.append(item);
    });
});

function closeSearch() {
    searchRequest += 1;
    searchResults.hidden = true;
}

searchInput.addEventListener("input", closeSearch);
document.addEventListener("pointerdown", (event) => {
    if (!searchForm.contains(event.target)) closeSearch();
});
searchForm.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !searchResults.hidden) {
        closeSearch();
        searchInput.focus();
    }
});
navigation.addEventListener("hide.bs.collapse", closeSearch);

const memberForm = document.querySelector("#medlemsformular");
if (memberForm) {
    const fields = Array.from(memberForm.querySelectorAll("input[required]"));
    const status = document.querySelector("#formularstatus");

    function validateField(field) {
        field.setCustomValidity(field.value.trim() ? "" : "Udfyld feltet.");
        const valid = field.validity.valid;
        const feedback = document.getElementById(field.getAttribute("aria-describedby"));
        if (field.validity.typeMismatch) {
            feedback.textContent = "Indtast en gyldig e-mailadresse.";
        } else if (field.validity.patternMismatch) {
            feedback.textContent = "Indtast et postnummer med fire cifre.";
        } else {
            feedback.textContent = "Udfyld feltet.";
        }
        field.setAttribute("aria-invalid", String(!valid));
        return valid;
    }

    memberForm.addEventListener("input", (event) => {
        status.textContent = "";
        if (memberForm.classList.contains("was-validated") && fields.includes(event.target)) {
            validateField(event.target);
        }
    });

    memberForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const invalidFields = fields.filter((field) => !validateField(field));
        memberForm.classList.add("was-validated");

        if (invalidFields.length) {
            status.textContent = "Ret de markerede felter.";
            invalidFields[0].focus();
            return;
        }

        memberForm.classList.remove("was-validated");
        status.textContent = "Tak. Tilmeldingen er gennemført som en test.";
    });
}

const detailsModal = document.querySelector("#detaljer");
if (detailsModal) {
    detailsModal.addEventListener("show.bs.modal", (event) => {
        const card = event.relatedTarget?.closest(".feature-row");
        if (!card) return;

        const title = card.querySelector("h2").textContent;
        detailsModal.querySelector(".modal-title").textContent = title;
        const photo = detailsModal.querySelector(".modal-body img");

        if (photo) {
            const thumbnail = card.querySelector("img");
            photo.src = thumbnail.getAttribute("src");
            photo.alt = thumbnail.alt;
        } else {
            const date = card.querySelector("time").textContent;
            const description = card.querySelector("p").textContent;
            detailsModal.querySelector(".modal-event").textContent = `${date} · ${description} Tid og sted er endnu ikke oplyst.`;
        }
    });

    detailsModal.addEventListener("hidden.bs.modal", () => {
        detailsModal.querySelector(".modal-body img")?.removeAttribute("src");
    });
}
