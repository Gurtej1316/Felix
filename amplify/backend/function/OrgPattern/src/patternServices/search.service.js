const {
    getSearchQuery, getUniqueValuesQuery,
    getUniqueValuesFromResponse
  } = require("@commonutils/search");
  const { Entities } = require("@commonmodels/elastic");
  const { GetElasticClient, ElasticIndices, getElasticHits } = require('@searchutils/models');
  
  /**
   * Service function which holds business logic to fetch unique values of each pattern table fields.
   */
  const getPropertyUniqueValues = async (orgId, properties) => {
    const aggregateQuery =  getUniqueValuesQuery(Entities.patterns, properties);
    console.log(aggregateQuery);
    const elasticClient =await GetElasticClient();
    const elasticResponse = await elasticClient.search({
      index: ElasticIndices.patterns,
      body: {
        aggs: aggregateQuery
      }
    });
    return getUniqueValuesFromResponse(elasticResponse, properties);
  };
  
  /**
   * Service function which holds business logic to fetch paginated and filtered patterns data.
   * @param {string} orgId
   * @param {*} options
   * @returns
   */
  const getSearchResults = async (orgId, options) => {
    const searchQuery = getSearchQuery(Entities.patterns, options);
    console.log('search query - ',searchQuery);
    const elasticClient =await GetElasticClient();
    const elasticResponse = await elasticClient.search({
      index: ElasticIndices.patterns,
      body: searchQuery
    });
    return getElasticHits(elasticResponse);
  };
  
  module.exports = {
    getPropertyUniqueValues,
    getSearchResults
  };