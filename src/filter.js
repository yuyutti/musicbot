const filter = [
    {
        name: "Rich",
        name_ja: "リッチ",
        auto: true,
        minVCSize: 3,
        filter: "loudnorm=I=-14:TP=-2:LRA=18"
    },
    {
        name: "Natural",
        name_ja: "ナチュラル",
        auto: true,
        minVCSize: 4,
        filter: "loudnorm=I=-16:TP=-1.2:LRA=16"
    },
    {
        name: "Balanced",
        name_ja: "バランス",
        auto: true,
        minVCSize: 6,
        filter: "loudnorm=I=-18:TP=-0.8:LRA=14"
    },
    {
        name: "Soft",
        name_ja: "ソフト",
        auto: true,
        minVCSize: 9,
        filter: "loudnorm=I=-20:TP=-0.2:LRA=12"
    },
    {
        name: "Disable",
        name_ja: "無効",
        auto: false,
        filter: "anull"
    }
]

module.exports = filter;