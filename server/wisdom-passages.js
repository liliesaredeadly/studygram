"use strict";

const PASSAGES = Object.freeze({
  gita: Object.freeze({
    text: "Your business is with action alone; not by any means with fruit. Let not the fruit of action be your motive (to action). Let not your attachment be (fixed) on inaction.",
    reference: "Bhagavad Gita 2.47",
    edition: "K. T. Telang, The Bhagavadgîtâ (1882), p. 48",
    url: "https://sacred-texts.com/book/the-bhagavadgita/chapter-ii",
    // Sanskrit text verified at https://heritage.iitk.ac.in/SBG/2.47
    original: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि।।",
  }),
  bible: Object.freeze({
    text: "And be kind to one another, tender hearted, forgiving each other, just as God also in Christ forgave you.",
    reference: "Ephesians 4:32",
    edition: "World English Bible Classic",
    url: "https://ebible.org/eng-web/EPH04.htm#V32",
  }),
});

module.exports = { PASSAGES };
