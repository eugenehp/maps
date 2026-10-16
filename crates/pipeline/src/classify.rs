//! Occupant classification and matching for the generated layers (layers.rs):
//! tech categories from names and websites, company sectors from Wikidata
//! industries / types and Overture place categories, mail-drop addresses,
//! and finding a company's building among Overture places.

use std::collections::{HashMap, HashSet};

/// Tech category from a name and website host, by keyword; `None` if nothing says.
/// Agencies and IT service shops come first: "Mobile App Development Company"
/// is a service business, not a developer-tools startup.
pub fn tech_from_name(name: &str, host: Option<&str>) -> Option<&'static str> {
    let low = name.to_lowercase();
    let words: Vec<&str> = low.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    let has = |w: &str| words.iter().any(|x| *x == w);
    let starts = |p: &str| words.iter().any(|x| x.starts_with(p));
    let phrase = |p: &str| low.contains(p);
    const SERVICES: &[&str] = &[
        "app development", "software development", "development company", "developers agency", "web design", "web development",
        "digital agency", "marketing agency", "it services", "it solutions", "managed services", "it consulting", "outsourcing",
        "software agency", "dev shop", "seo ",
    ];
    if SERVICES.iter().any(|p| phrase(p)) || has("agency") || has("consulting") || has("consultants") || has("consultancy") || has("staffing") {
        return Some("services");
    }
    let tld_ai = host.is_some_and(|h| h.ends_with(".ai"));
    if tld_ai || has("ai") || has("gpt") || has("llm") || has("ml") || has("neural") || phrase("machine learning") || phrase("artificial intelligence") || phrase("deep learning") {
        return Some("ai");
    }
    if starts("robot") || has("drones") || has("drone") || has("autonomy") {
        return Some("robotics");
    }
    if has("aerospace") || has("satellite") || has("satellites") || has("orbital") || has("rocket") || has("space") && !has("coworking") && !has("workspace") {
        return Some("space");
    }
    if has("semiconductor") || has("semiconductors") || has("silicon") || has("photonics") || has("chips") {
        return Some("semiconductors");
    }
    if starts("pharma") {
        return Some("pharma");
    }
    if starts("therapeutic") || starts("genom") || starts("genet") || has("biosciences") || has("bioscience") || has("biotech")
        || has("biologics") || has("bio") || has("crispr") || has("biotherapeutics") {
        return Some("biotech");
    }
    if has("surgical") || has("diagnostics") || phrase("medical device") || has("medtech") {
        return Some("medtech");
    }
    if starts("health") || has("telehealth") || has("clinic") || has("care") && has("health") {
        return Some("healthtech");
    }
    if starts("crypto") || starts("blockchain") || has("bitcoin") || has("web3") || has("defi") || has("nft") || has("chain") {
        return Some("crypto");
    }
    if has("pay") || has("payments") || has("payroll") || has("fintech") || has("lending") || has("wallet") || has("banking") {
        return Some("fintech");
    }
    if starts("cyber") || has("security") || has("secure") {
        return Some("security");
    }
    if has("games") || has("gaming") || has("game") {
        return Some("gaming");
    }
    if has("solar") || has("energy") || has("climate") || has("carbon") || has("battery") || has("batteries") || has("fusion") || has("hydrogen") || has("grid") {
        return Some("energy");
    }
    if has("mobility") || has("ev") || has("scooters") || has("freight") || has("fleet") || has("logistics") {
        return Some("transport");
    }
    if has("devops") || has("api") || has("apis") || has("sdk") || has("compiler") || has("developer") || has("developers") || has("git") {
        return Some("devtools");
    }
    None
}

/// Overture place categories kept for the startups layer, -> category.
pub fn tech_from_place(cat: &str) -> Option<&'static str> {
    Some(match cat {
        "software_development" => "saas",
        "information_technology_company" => "software",
        "social_media_company" => "consumer",
        "computer_hardware_company" => "devices",
        "biotechnology_company" => "biotech",
        "pharmaceutical_companies" | "pharmaceutical_company" => "pharma",
        "b2b_scientific_lab" => "biotech",
        "energy_company" => "energy",
        "web_hosting_service" => "saas",
        "web_designer" => "services",
        "game_publisher" => "gaming",
        _ => return None,
    })
}

/// Sector of an older or non-tech company (the `companies` layer), from Wikidata
/// industry labels, then Wikidata type labels, then its Overture place category.
pub fn sector(industries: &[String], types: &[String], place_cat: Option<&str>) -> &'static str {
    const RULES: &[(&str, &str)] = &[
        // specific before generic; matched as substrings of lower-cased labels
        ("real estate", "realestate"), ("construction", "realestate"), ("property", "realestate"), ("real_estate", "realestate"),
        ("architect", "professional"), ("law firm", "professional"), ("legal", "professional"), ("lawyer", "professional"),
        ("consult", "professional"), ("accounting", "professional"), ("accountant", "professional"), ("advertis", "professional"),
        ("marketing", "professional"), ("public relations", "professional"), ("market research", "professional"),
        ("human resource", "professional"), ("staffing", "professional"), ("engineering", "professional"), ("professional service", "professional"),
        ("insurance", "finance"), ("bank", "finance"), ("financ", "finance"), ("invest", "finance"), ("venture capital", "finance"),
        ("private equity", "finance"), ("hedge fund", "finance"), ("asset management", "finance"), ("credit", "finance"), ("stock exchange", "finance"),
        ("hotel", "food"), ("restaurant", "food"), ("food", "food"), ("beverage", "food"), ("brew", "food"), ("winery", "food"), ("wine", "food"),
        ("coffee", "food"), ("bakery", "food"), ("gastronom", "food"), ("distiller", "food"), ("cafe", "food"), ("café", "food"), ("hospitality", "food"),
        ("bar", "food"), ("pub", "food"), ("tavern", "food"), ("saloon", "food"), ("hostel", "food"), ("motel", "food"), ("inn", "food"),
        ("drinking establishment", "food"), ("supper club", "food"),
        ("nightclub", "media"), ("jazz club", "media"), ("music venue", "media"), ("venue", "media"), ("gallery", "media"), ("museum", "media"),
        ("amusement", "media"), ("dance", "media"), ("circus", "media"), ("art", "media"), ("arts", "media"),
        ("publish", "media"), ("newspaper", "media"), ("media", "media"), ("film", "media"), ("television", "media"), ("broadcast", "media"),
        ("radio", "media"), ("music", "media"), ("record label", "media"), ("printing", "media"), ("comic", "media"), ("cinema", "media"),
        ("movie theater", "media"), ("theatre", "media"), ("theater", "media"), ("entertainment", "media"), ("journalism", "media"),
        ("photograph", "media"), ("magazine", "media"), ("animation", "media"),
        ("airline", "transport"), ("railway", "transport"), ("rail", "transport"), ("shipping", "transport"), ("logistic", "transport"),
        ("transport", "transport"), ("automotive", "transport"), ("shipbuilding", "transport"), ("trucking", "transport"), ("ferry", "transport"),
        ("health", "health"), ("hospital", "health"), ("medical", "health"), ("pharmac", "health"), ("dental", "health"), ("clinic", "health"),
        ("software", "tech"), ("internet", "tech"), ("computer", "tech"), ("electronic", "tech"), ("telecom", "tech"), ("semiconductor", "tech"),
        ("information technology", "tech"), ("technology", "tech"), ("video game", "tech"), ("biotech", "tech"), ("e-commerce", "tech"),
        ("energy", "industry"), ("electric power", "industry"), ("utility", "industry"), ("petroleum", "industry"), ("oil", "industry"),
        ("gas", "industry"), ("chemical", "industry"), ("manufactur", "industry"), ("steel", "industry"), ("mining", "industry"),
        ("textile", "industry"), ("industrial", "industry"), ("factory", "industry"),
        ("retail", "retail"), ("store", "retail"), ("shop", "retail"), ("clothing", "retail"), ("fashion", "retail"), ("cosmetic", "retail"),
        ("jewel", "retail"), ("department", "retail"), ("supermarket", "retail"), ("apparel", "retail"), ("toy", "retail"), ("furniture", "retail"),
        ("wholesale", "retail"), ("consumer goods", "retail"), ("personal care", "retail"),
    ];
    let pick = |labels: &mut dyn Iterator<Item = String>| -> Option<&'static str> {
        let labels: Vec<String> = labels.map(|l| l.to_lowercase().replace('_', " ")).collect();
        RULES.iter().find(|(k, _)| labels.iter().any(|l| word_start(l, k))).map(|(_, s)| *s)
    };
    pick(&mut industries.iter().cloned())
        // the generic company types say nothing about the sector
        .or_else(|| pick(&mut types.iter().filter(|t| !GENERIC_TYPES.contains(&t.to_lowercase().as_str())).cloned()))
        .or_else(|| pick(&mut place_cat.map(String::from).into_iter()))
        .unwrap_or("other")
}

/// `k` occurs in `l` at the start of a word ("rail" in "rail transport", not in "retail");
/// keys of 4 letters or fewer as whole words ("bar", not "barber"; "art", not "artificial").
fn word_start(l: &str, k: &str) -> bool {
    let edge = |c: Option<char>| c.map_or(true, |c| !c.is_alphanumeric());
    l.match_indices(k).any(|(i, _)| edge(l[..i].chars().next_back()) && (k.chars().count() > 4 || edge(l[i + k.len()..].chars().next())))
}

/// Wikidata files libraries, schools, agencies and buildings under "business" too:
/// they are not companies (academia has the schools).
pub fn not_a_company(type_labels: &[String]) -> bool {
    const K: &[&str] = &[
        "library", "bookmobile", "school", "university", "college", "educational", "academy", "academic", "government",
        "agency", "police", "law enforcement", "municipal", "building", "consulate", "embassy", "church", "parish",
        "political party", "trade union", "labor union", "military",
    ];
    !type_labels.is_empty() && type_labels.iter().all(|t| {
        let t = t.to_lowercase();
        K.iter().any(|k| t.contains(k)) || GENERIC_TYPES.contains(&t.as_str()) || t == "defunct organization"
    }) && type_labels.iter().any(|t| {
        let t = t.to_lowercase();
        K.iter().any(|k| t.contains(k))
    })
}

const GENERIC_TYPES: &[&str] = &[
    "business", "enterprise", "company", "public company", "privately held company", "subsidiary", "organization", "brand",
    "holding company", "corporation", "limited liability company", "joint-stock company", "conglomerate", "startup company",
];

/// Website host without `www.`, and whether the URL is just the site (no path).
pub fn host(url: &str) -> Option<(String, bool)> {
    let rest = url.trim().split_once("://").map_or(url.trim(), |(_, r)| r);
    let (h, path) = rest.split_once('/').map_or((rest, ""), |(h, p)| (h, p));
    let h = h.split(':').next()?.trim_start_matches("www.").to_lowercase();
    if h.is_empty() || !h.contains('.') {
        return None;
    }
    let bare = path.trim_matches('/').is_empty() || path.starts_with('?') || path.starts_with('#');
    Some((h, bare))
}

/// Hosts shared by unrelated businesses (social profiles, site builders): never a match.
pub fn generic_host(h: &str) -> bool {
    const G: &[&str] = &[
        "facebook.com", "x.com", "twitter.com", "linkedin.com", "instagram.com", "google.com", "sites.google.com", "business.site",
        "yelp.com", "youtube.com", "linktr.ee", "medium.com", "angel.co", "wellfound.com", "crunchbase.com", "squareup.com",
        "square.site", "wix.com", "godaddysites.com", "tiktok.com", "github.com", "apps.apple.com", "play.google.com", "bit.ly",
        "eventbrite.com", "meetup.com", "craigslist.org",
    ];
    G.contains(&h)
}

/// Street part of a free-form address: "548 Market St PMB 1234" -> "548 market st".
pub fn street(addr: &str) -> String {
    let low = addr.to_lowercase();
    let mut cut = low.len();
    for m in [" pmb", " ste ", " ste.", " suite", "#", " fl ", " floor", " unit", " apt", ",", " rm ", " room"] {
        if let Some(i) = low.find(m) {
            cut = cut.min(i);
        }
    }
    low[..cut].split_whitespace().collect::<Vec<_>>().join(" ")
}

/// A private mailbox (a mail-drop or registered-agent address, not an office).
pub fn is_pmb(addr: &str) -> bool {
    let low = addr.to_lowercase();
    low.contains(" pmb") || low.starts_with("pmb") || low.contains("private mailbox") || low.contains("mailbox ")
}

/// Street addresses that are mail-drops: at least 5 private mailboxes, making up
/// at least 15% of the places listed there. (548 Market St, San Francisco: 213 of 542.)
pub fn mail_drops<'a>(addrs: impl Iterator<Item = &'a str>) -> HashSet<String> {
    let mut n: HashMap<String, (u32, u32)> = HashMap::new();
    for a in addrs {
        let e = n.entry(street(a)).or_default();
        e.0 += 1;
        e.1 += is_pmb(a) as u32;
    }
    n.into_iter().filter(|(s, (t, p))| !s.is_empty() && *p >= 5 && *p * 100 >= *t * 15).map(|(s, _)| s).collect()
}

/// Overture categories a company's own office can have (for matching by name only:
/// "Soma" the beverage company is not "Soma" the watch repair shop).
pub fn office_like(cat: &str) -> bool {
    const K: &[&str] = &[
        "company", "office", "software", "information_technology", "agency", "bank", "financ", "invest", "consult", "lawyer",
        "law_firm", "architect", "media", "publish", "studio", "lab", "research", "manufactur", "marketing", "advertis",
        "engineering", "venture", "insurance", "accountant", "biotech", "pharma", "energy", "telecom", "internet", "web_",
        "broadcast", "airline", "logistics", "real_estate", "business", "game",
    ];
    K.iter().any(|k| cat.contains(k))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names() {
        assert_eq!(tech_from_name("TekRevol - Mobile App Development Company", None), Some("services"));
        assert_eq!(tech_from_name("BeFound AI", None), Some("ai"));
        assert_eq!(tech_from_name("Juicebox", Some("juicebox.ai")), Some("ai"));
        assert_eq!(tech_from_name("Arcus Biosciences", None), Some("biotech"));
        assert_eq!(tech_from_name("Payfederate", None), None);
        assert_eq!(tech_from_name("Nuro Robotics", None), Some("robotics"));
        assert_eq!(tech_from_name("Galvanize coworking space", None), None);
        assert_eq!(tech_from_name("Airtable", Some("airtable.com")), None);
    }

    #[test]
    fn sectors() {
        assert_eq!(sector(&["financial services".into()], &[], None), "finance");
        assert_eq!(sector(&[], &["hotel".into()], None), "food");
        assert_eq!(sector(&[], &["business".into()], Some("law_firm")), "professional");
        assert_eq!(sector(&[], &["enterprise".into()], None), "other");
        assert_eq!(sector(&["retail".into()], &[], None), "retail");
        assert_eq!(sector(&[], &["gay bar".into()], None), "food");
        assert_eq!(sector(&[], &["barber shop".into()], None), "retail");
        assert_eq!(sector(&["artificial intelligence".into()], &[], None), "other");
        assert!(not_a_company(&["library branch".into(), "public library".into()]));
        assert!(!not_a_company(&["business school".into(), "hotel".into()]));
        assert!(!not_a_company(&["business".into()]));
    }

    #[test]
    fn addresses() {
        assert_eq!(street("548 Market St PMB 12345"), "548 market st");
        assert_eq!(street("201 Spear St  Ste 1100"), "201 spear st");
        assert!(is_pmb("548 Market St PMB 12345"));
        let a = ["548 Market St PMB 1", "548 Market St PMB 2", "548 Market St PMB 3", "548 Market St PMB 4", "548 Market St PMB 5", "548 Market St", "201 Spear St Ste 2"];
        let d = mail_drops(a.iter().copied());
        assert!(d.contains("548 market st") && !d.contains("201 spear st"));
        assert_eq!(host("https://www.Airtable.com/"), Some(("airtable.com".into(), true)));
        assert_eq!(host("https://www.ibm.com/digital-marketing/tealeaf"), Some(("ibm.com".into(), false)));
    }
}
