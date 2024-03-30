const { getSearchQuery, getUniqueValuesQuery, getUniqueValuesFromResponse } = require("@commonutils/search");
const { Entities } = require("@commonmodels/elastic");
const { GetElasticClient, ElasticIndices, getElasticHits } = require("@searchutils/models");

/**
 * Service function which holds business logic to fetch unique values of each actions table fields.
 */
const getPropertyUniqueValues = async (orgId, properties) => {
  const aggregateQuery = getUniqueValuesQuery(Entities.actions, properties);
  console.log(aggregateQuery);
  const elasticClient = await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.actions,
    body: {
      aggs: aggregateQuery,
    },
  });
  return getUniqueValuesFromResponse(elasticResponse, properties);
};

/**
 * Service function which holds business logic to fetch paginated and filtered actions data.
 * @param {string} orgId
 * @param {*} options
 * @returns
 */
const getSearchResults = async (orgId, options) => {
  const searchQuery = getSearchQuery(Entities.actions, options);
  console.log("search query - ", searchQuery);
  const elasticClient = await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.actions,
    body: searchQuery,
  });
  return getElasticHits(elasticResponse);
};

module.exports = {
  getPropertyUniqueValues,
  getSearchResults,
};
