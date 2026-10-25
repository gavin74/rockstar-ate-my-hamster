// Headlines and log lines in the remake's own words. They are not the original's
// text: the original's messages live in the tape data, which the remake does not use.

export const HEADLINES = {
  charityGenuine: "The band's charity gig raised money for a good cause.",
  charityScam: "The charity turned out to be a scam, and the band is red-faced.",
  badPressCharity: "Press say the band turned down a real charity.",
  publicityNobody: "The band did a publicity stunt. Nobody noticed.",
  publicityStory: "The press ran a story about the band's latest stunt.",
  publicityDeath: "Tragedy: a band member has died.",
  scandal: "A scandal breaks about one of the band's sponsors. Fame is halved.",
  trouble: {
    jailed: "A band member was jailed after a night out.",
    wrecked: "A band member wrecked a hotel suite.",
  },
  sued: "The band was sued. £1,000,000 paid.",
  taxman: "The taxman called. £1,000,000 paid.",
  equipmentLost: "The band's equipment was lost in transit.",
  bootlegs: "Bootleggers are copying the album.",
  demand: "A band member wants the show improved.",
  ultimatum: "A band member has given an ultimatum.",
} as const;
