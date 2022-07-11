const fetchRuleGroupPromos = async (ruleGroup, lang, retry = 0) => {
    let group = [];
    try {
        group = await fetch(
            `https://infoservice.sunwingtravelgroup.com/search/Offers/Promotions?lang=${lang}&type=flight&alias=btd&name=${encodeURIComponent(
                ruleGroup.rule.trim()
            )}`
        ).then(response => {
            if (response.ok) {
                return response.json();
            }
            if (retry < 3) {
                return fetchRuleGroupPromos(ruleGroup, lang, retry + 1);
            }
            throw response;
        });
    } catch (error) {
        if (retry < 3) {
            return fetchRuleGroupPromos(ruleGroup, lang, retry + 1);
        }
        console.warn(
            `Error fetching rule group promos (${ruleGroup.rule} - ${lang} - ${retry}): `,
            error
        );
        group = [{ errors: { rule: ruleGroup.rule, lang, error } }];
    }
    return group;
};
const fetchRuleGroup = async ruleGroup => {
    try {
        const lang = ruleGroup.node_locale.substring(0, 2).toLowerCase().includes("fr") ? "fr" : "en";
        const ruleGroupData = await fetchRuleGroupPromos(ruleGroup, lang);
        console.log(`${ruleGroup.rule} with ${ruleGroupData.length} gateways`);
        if (ruleGroupData.length === 0) {
            console.warn(ruleGroupData);
        }
        const allErrors = ruleGroupData
            .reduce((prev, curr) => {
                if (curr) {
                    prev.push(curr.errors);
                }
                return prev;
            }, [])
            .filter(x => x);
        return {
            ruleGroup,
            data: ruleGroupData,
            errors: allErrors.length ? allErrors : null,
        };
    } catch (err) {
        console.warn("FetchRuleGroup", err);
        return {
            ruleGroup,
            data: [],
            errors: [err],
            totalAPICalls: 0,
        };
    }
};
function fetchAllRuleGroups(items, chunkSize = 5) {
    const _chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        _chunks.push(items.slice(i, i + chunkSize));
    }
    const allRuleGroupData = _chunks.reduce(async (acc, chunk) => {
        const promisedAccumulator = await acc;
        const promises = chunk.map(ruleGroup => fetchRuleGroup(ruleGroup));
        const ruleGroupData = await Promise.all(promises);
        ruleGroupData.forEach(({ data, ruleGroup, errors, totalAPICalls }) => {
            promisedAccumulator.data.push({
                data,
                ruleGroup,
            });
            if (errors) {
                promisedAccumulator.errors.push({
                    errors,
                    ruleGroup,
                });
            }
            promisedAccumulator.totalAPICalls += totalAPICalls;
        });
        return promisedAccumulator;
    }, Promise.resolve({ data: [], errors: [], totalAPICalls: 0 }));
    return allRuleGroupData;
}
