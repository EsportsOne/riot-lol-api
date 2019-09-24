"use strict";

const GENERAL_PLATFORMS = {
  br: "BR1",
  eune: "EUN1",
  euw: "EUW1",
  kr: "KR",
  lan: "LA1",
  las: "LA2",
  na: "NA1",
  oce: "OC1",
  tr: "TR1",
  ru: "RU",
  jp: "JP1"
};

const GARENA_PLATFORMS = {
  ph: "PH",
  sg: "SG",
  vn: "VN",
  th: "TH",
  tw: "TW"
};

module.exports.isGarenaRegion = region => {
  return !!GARENA_PLATFORMS[region];
};

module.exports.getPlatform = region => {
  return (
    GENERAL_PLATFORMS[region.toLowerCase()] ||
    GARENA_PLATFORMS[region.toLowerCase()]
  );
};

module.exports.REGIONS = [
  ...Object.keys(GENERAL_PLATFORMS),
  ...Object.keys(GARENA_PLATFORMS)
];
module.exports.GENERAL_PLATFORMS = GENERAL_PLATFORMS;
module.exports.GARENA_PLATFORMS = GARENA_PLATFORMS;
module.exports.PLATFORMS = [
  ...Object.keys(GENERAL_PLATFORMS),
  ...Object.keys(GARENA_PLATFORMS)
].map(function(key) {
  return GENERAL_PLATFORMS[key] || GARENA_PLATFORMS[key];
});
