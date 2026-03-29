import { describe, it, expect } from 'vitest';
import { HybridSearchService, IVecSearcher, IFTSSearcher } from '../hybrid-search.service';

describe('HybridSearchService RRF Engine', () => {
  it('should correctly fuse and re-rank results using Reciprocal Rank Fusion formula', async () => {
    // 模拟纯语义搜索查出的结果（按距离越小越靠前）
    const mockVecSearcher: IVecSearcher = {
      searchByVector: async () => [
        { sourceId: 'd-1', sourceType: 'diary', chunkText: '今天非常开心去爬山', distance: 0.1 }, // rank 1
        { sourceId: 'd-2', sourceType: 'diary', chunkText: '开心吃大餐', distance: 0.3 },        // rank 2
        { sourceId: 'd-3', sourceType: 'diary', chunkText: '山上的风很大', distance: 0.5 }        // rank 3
      ]
    };

    // 模拟 FTS 全文搜索查出的结果（按负 rank 分越小越靠前）
    const mockFtsSearcher: IFTSSearcher = {
      searchAll: async () => [
        { sourceId: 'd-3', sourceType: 'diary', contentSnippet: '<b>山</b>上的风很大', rankScore: -50.0 }, // rank 1
        { sourceId: 'd-1', sourceType: 'diary', contentSnippet: '去爬<b>山</b>', rankScore: -10.0 }        // rank 2
        // d-2 不在里面，它没有匹配到 "山"
      ]
    };

    const service = new HybridSearchService(mockVecSearcher, mockFtsSearcher);
    
    // 我们假设由于同时出现在两个榜单 (尤其是 d-1，在 vec 是 1， fts 是 2；d-3 在 vec 是 3， fts 是 1)
    // 我们可以算出 RRF 分数：
    // K = 60， alpha = 0.5 (默认)
    // d-1 = 0.5 * (1/61) + 0.5 * (1/62) ≈ 0.00819 + 0.00806 = 0.01625
    // d-3 = 0.5 * (1/63) + 0.5 * (1/61) ≈ 0.00793 + 0.00819 = 0.01612
    // d-2 = 0.5 * (1/62) + 0             ≈ 0.00806
    // 所以经过融合重排后，应该是 d-1 排最高，其次是 d-3，最后是 d-2

    const results = await service.search({
      queryText: '山',
      queryVector: [0.1, 0.2], // Mock 无所谓数值
      modelId: 'mock'
    });

    expect(results.length).toBe(3);
    
    // 检查倒数排名融合洗牌是否符合预期
    expect(results[0]?.sourceId).toBe('d-1');
    expect(results[1]?.sourceId).toBe('d-3');
    expect(results[2]?.sourceId).toBe('d-2');

    // d-1 同时拿到了高亮片段
    expect(results[0]?.contentSnippet).toContain('<b>山</b>');

    // 确保打分被计算并装载
    expect(results[0]?.score).toBeGreaterThan(0.01);
  });
});
