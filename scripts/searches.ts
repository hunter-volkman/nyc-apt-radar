import "../src/config/env";
import { activeSearchConfigs, getSearchesPath, hasSearchConfigFile, loadSearchConfigs, safeSearchUrl, searchSourceName } from "../src/discovery/searches";

const configPath = getSearchesPath();

if (!hasSearchConfigFile(configPath)) {
  console.log("No searches config found.");
  console.log(`Create ${configPath} from data/searches.example.json to enable StreetEasy search execution.`);
  process.exit(0);
}

const searches = loadSearchConfigs(configPath);
const active = activeSearchConfigs(searches);

console.log(`NYC Apt Radar searches - ${active.length} active of ${searches.length}`);
console.log(`Config: ${configPath}`);
console.log("");

for (const search of searches) {
  const state = search.enabled === false ? "DISABLED" : "ACTIVE";
  console.log(`${state} ${search.id}`);
  console.log(`    Provider: ${search.provider}`);
  console.log(`    Name: ${searchSourceName(search)}`);
  console.log(`    URL: ${safeSearchUrl(search.searchUrl)}`);
  console.log(`    Result limit: ${search.resultLimit ?? process.env.NYC_APT_RADAR_SEARCH_RESULT_LIMIT ?? 12}`);
  console.log("");
}
