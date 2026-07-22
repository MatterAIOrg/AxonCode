import type { IconType } from "react-icons"
import { FaMicrosoft } from "react-icons/fa6"
import {
	SiAmazonwebservices,
	SiAsana,
	SiAtlassian,
	SiBitbucket,
	SiBox,
	SiCloudflare,
	SiCodepen,
	SiCodesandbox,
	SiConfluence,
	SiDatadog,
	SiDevdotto,
	SiDigitalocean,
	SiDiscord,
	SiDocker,
	SiDropbox,
	SiFacebook,
	SiFigma,
	SiFirebase,
	SiGitbook,
	SiGithub,
	SiGitlab,
	SiGmail,
	SiGoogle,
	SiGooglecalendar,
	SiGooglecloud,
	SiGoogledocs,
	SiGoogledrive,
	SiGoogleforms,
	SiGooglemaps,
	SiGooglemeet,
	SiGooglesheets,
	SiGoogleslides,
	SiGrafana,
	SiHashnode,
	SiHeroku,
	SiInstagram,
	SiJira,
	SiKubernetes,
	SiLinear,
	SiLinkedin,
	SiMdnwebdocs,
	SiMedium,
	SiNetlify,
	SiNotion,
	SiNpm,
	SiOpenai,
	SiPinterest,
	SiPostman,
	SiReddit,
	SiSalesforce,
	SiSentry,
	SiShopify,
	SiSlack,
	SiSpotify,
	SiStackblitz,
	SiStackoverflow,
	SiStripe,
	SiSupabase,
	SiTelegram,
	SiTiktok,
	SiTrello,
	SiTwitch,
	SiVercel,
	SiVimeo,
	SiWhatsapp,
	SiWikipedia,
	SiWordpress,
	SiX,
	SiYoutube,
	SiZoom,
} from "react-icons/si"
import { VscAzure } from "react-icons/vsc"

export interface LinkBrand {
	id: string
	Icon: IconType
}

interface LinkBrandDefinition extends LinkBrand {
	matches: (url: URL) => boolean
}

const matchesDomain = (hostname: string, domain: string) => hostname === domain || hostname.endsWith(`.${domain}`)

const onDomains =
	(...domains: string[]) =>
	(url: URL) =>
		domains.some((domain) => matchesDomain(url.hostname, domain))

const onDomainPath =
	(domain: string, ...pathPrefixes: string[]) =>
	(url: URL) =>
		matchesDomain(url.hostname, domain) && pathPrefixes.some((prefix) => url.pathname.startsWith(prefix))

const googleDomains = [
	"google.com",
	"google.co.uk",
	"google.co.in",
	"google.ca",
	"google.de",
	"google.fr",
	"google.es",
	"google.it",
	"google.co.jp",
	"google.com.au",
	"google.com.br",
	"google.nl",
	"google.pl",
	"google.co.kr",
	"google.com.mx",
	"google.com.sg",
	"google.co.za",
	"google.ie",
	"google.ch",
	"google.se",
	"google.no",
	"google.dk",
	"google.fi",
	"google.be",
	"google.at",
	"google.pt",
	"google.co.nz",
	"google.ae",
	"google.com.tr",
	"google.co.id",
]

// Keep specific products before their parent companies so the most useful icon wins.
const linkBrandDefinitions: LinkBrandDefinition[] = [
	{ id: "google-sheets", Icon: SiGooglesheets, matches: onDomainPath("docs.google.com", "/spreadsheets") },
	{ id: "google-slides", Icon: SiGoogleslides, matches: onDomainPath("docs.google.com", "/presentation") },
	{ id: "google-forms", Icon: SiGoogleforms, matches: onDomainPath("docs.google.com", "/forms") },
	{ id: "google-docs", Icon: SiGoogledocs, matches: onDomains("docs.google.com") },
	{ id: "google-drive", Icon: SiGoogledrive, matches: onDomains("drive.google.com") },
	{ id: "google-calendar", Icon: SiGooglecalendar, matches: onDomains("calendar.google.com") },
	{ id: "gmail", Icon: SiGmail, matches: onDomains("gmail.com", "mail.google.com") },
	{ id: "google-meet", Icon: SiGooglemeet, matches: onDomains("meet.google.com") },
	{ id: "google-maps", Icon: SiGooglemaps, matches: onDomains("maps.google.com") },
	{ id: "google-cloud", Icon: SiGooglecloud, matches: onDomains("cloud.google.com") },
	{ id: "firebase", Icon: SiFirebase, matches: onDomains("firebase.google.com", "firebaseapp.com") },
	{ id: "youtube", Icon: SiYoutube, matches: onDomains("youtube.com", "youtu.be", "youtube-nocookie.com") },
	{ id: "google", Icon: SiGoogle, matches: onDomains(...googleDomains) },
	{
		id: "azure",
		Icon: VscAzure,
		matches: onDomains(
			"azure.com",
			"azure.microsoft.com",
			"azurewebsites.net",
			"dev.azure.com",
			"visualstudio.com",
		),
	},
	{
		id: "microsoft",
		Icon: FaMicrosoft,
		matches: onDomains(
			"microsoft.com",
			"microsoftonline.com",
			"microsoft365.com",
			"office.com",
			"office365.com",
			"live.com",
			"outlook.com",
			"sharepoint.com",
			"onedrive.com",
			"teams.microsoft.com",
			"aka.ms",
			"1drv.ms",
		),
	},
	{
		id: "github",
		Icon: SiGithub,
		matches: onDomains("github.com", "github.dev", "github.io", "githubusercontent.com"),
	},
	{ id: "gitlab", Icon: SiGitlab, matches: onDomains("gitlab.com") },
	{ id: "bitbucket", Icon: SiBitbucket, matches: onDomains("bitbucket.org") },
	{ id: "figma", Icon: SiFigma, matches: onDomains("figma.com") },
	{ id: "confluence", Icon: SiConfluence, matches: onDomainPath("atlassian.net", "/wiki") },
	{ id: "jira", Icon: SiJira, matches: onDomains("jira.com", "atlassian.net") },
	{ id: "atlassian", Icon: SiAtlassian, matches: onDomains("atlassian.com") },
	{ id: "slack", Icon: SiSlack, matches: onDomains("slack.com") },
	{ id: "notion", Icon: SiNotion, matches: onDomains("notion.so", "notion.site") },
	{ id: "linear", Icon: SiLinear, matches: onDomains("linear.app") },
	{ id: "stack-overflow", Icon: SiStackoverflow, matches: onDomains("stackoverflow.com", "stackexchange.com") },
	{ id: "npm", Icon: SiNpm, matches: onDomains("npmjs.com") },
	{ id: "linkedin", Icon: SiLinkedin, matches: onDomains("linkedin.com") },
	{ id: "x", Icon: SiX, matches: onDomains("x.com", "twitter.com") },
	{ id: "reddit", Icon: SiReddit, matches: onDomains("reddit.com", "redd.it") },
	{ id: "discord", Icon: SiDiscord, matches: onDomains("discord.com", "discord.gg") },
	{ id: "dropbox", Icon: SiDropbox, matches: onDomains("dropbox.com") },
	{ id: "box", Icon: SiBox, matches: onDomains("box.com") },
	{ id: "aws", Icon: SiAmazonwebservices, matches: onDomains("aws.amazon.com", "amazonaws.com") },
	{ id: "cloudflare", Icon: SiCloudflare, matches: onDomains("cloudflare.com") },
	{ id: "vercel", Icon: SiVercel, matches: onDomains("vercel.com", "vercel.app") },
	{ id: "netlify", Icon: SiNetlify, matches: onDomains("netlify.com", "netlify.app") },
	{ id: "docker", Icon: SiDocker, matches: onDomains("docker.com", "docker.io") },
	{ id: "kubernetes", Icon: SiKubernetes, matches: onDomains("kubernetes.io") },
	{ id: "digitalocean", Icon: SiDigitalocean, matches: onDomains("digitalocean.com") },
	{ id: "heroku", Icon: SiHeroku, matches: onDomains("heroku.com", "herokuapp.com") },
	{ id: "salesforce", Icon: SiSalesforce, matches: onDomains("salesforce.com") },
	{ id: "trello", Icon: SiTrello, matches: onDomains("trello.com") },
	{ id: "asana", Icon: SiAsana, matches: onDomains("asana.com") },
	{ id: "zoom", Icon: SiZoom, matches: onDomains("zoom.us") },
	{ id: "medium", Icon: SiMedium, matches: onDomains("medium.com") },
	{ id: "dev-to", Icon: SiDevdotto, matches: onDomains("dev.to") },
	{ id: "hashnode", Icon: SiHashnode, matches: onDomains("hashnode.com", "hashnode.dev") },
	{ id: "codepen", Icon: SiCodepen, matches: onDomains("codepen.io") },
	{ id: "codesandbox", Icon: SiCodesandbox, matches: onDomains("codesandbox.io") },
	{ id: "stackblitz", Icon: SiStackblitz, matches: onDomains("stackblitz.com") },
	{ id: "gitbook", Icon: SiGitbook, matches: onDomains("gitbook.com", "gitbook.io") },
	{ id: "openai", Icon: SiOpenai, matches: onDomains("openai.com", "chatgpt.com") },
	{ id: "facebook", Icon: SiFacebook, matches: onDomains("facebook.com", "fb.com") },
	{ id: "instagram", Icon: SiInstagram, matches: onDomains("instagram.com") },
	{ id: "whatsapp", Icon: SiWhatsapp, matches: onDomains("whatsapp.com", "wa.me") },
	{ id: "telegram", Icon: SiTelegram, matches: onDomains("telegram.org", "t.me") },
	{ id: "tiktok", Icon: SiTiktok, matches: onDomains("tiktok.com") },
	{ id: "spotify", Icon: SiSpotify, matches: onDomains("spotify.com") },
	{ id: "twitch", Icon: SiTwitch, matches: onDomains("twitch.tv") },
	{ id: "pinterest", Icon: SiPinterest, matches: onDomains("pinterest.com", "pin.it") },
	{ id: "vimeo", Icon: SiVimeo, matches: onDomains("vimeo.com") },
	{ id: "wikipedia", Icon: SiWikipedia, matches: onDomains("wikipedia.org") },
	{ id: "mdn", Icon: SiMdnwebdocs, matches: onDomains("developer.mozilla.org") },
	{ id: "postman", Icon: SiPostman, matches: onDomains("postman.com") },
	{ id: "sentry", Icon: SiSentry, matches: onDomains("sentry.io") },
	{ id: "datadog", Icon: SiDatadog, matches: onDomains("datadoghq.com") },
	{ id: "grafana", Icon: SiGrafana, matches: onDomains("grafana.com") },
	{ id: "supabase", Icon: SiSupabase, matches: onDomains("supabase.com") },
	{ id: "stripe", Icon: SiStripe, matches: onDomains("stripe.com") },
	{ id: "shopify", Icon: SiShopify, matches: onDomains("shopify.com") },
	{ id: "wordpress", Icon: SiWordpress, matches: onDomains("wordpress.com", "wordpress.org") },
]

export const getLinkBrand = (href?: string): LinkBrand | undefined => {
	if (!href) {
		return undefined
	}

	try {
		const url = new URL(href)
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return undefined
		}

		return linkBrandDefinitions.find(({ matches }) => matches(url))
	} catch {
		return undefined
	}
}
