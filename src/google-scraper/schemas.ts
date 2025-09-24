import { z } from 'zod';

export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  position: z.number().int().positive(),
});

export const GoogleSearchItemSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  snippet: z.string(),
  pagemap: z
    .object({
      cse_thumbnail: z
        .array(
          z.object({
            src: z.string(),
            width: z.string(),
            height: z.string(),
          })
        )
        .optional(),
      metatags: z.array(z.record(z.string())).optional(),
    })
    .optional(),
});

export const GoogleSearchResponseSchema = z.object({
  items: z.array(GoogleSearchItemSchema).optional(),
  searchInformation: z.object({
    totalResults: z.string(),
    searchTime: z.number(),
  }),
  queries: z.object({
    request: z.array(
      z.object({
        title: z.string(),
        totalResults: z.string().optional(),
        searchTerms: z.string(),
        count: z.number().int(),
        startIndex: z.number().int(),
      })
    ),
    nextPage: z
      .array(
        z.object({
          title: z.string(),
          totalResults: z.string().optional(),
          searchTerms: z.string(),
          count: z.number().int(),
          startIndex: z.number().int(),
        })
      )
      .optional(),
  }),
});

export const SearchOptionsSchema = z.object({
  maxResults: z.number().int().positive().max(100).optional(),
  startIndex: z.number().int().positive().optional(),
});

export const SearchErrorSchema = z.object({
  error: z.object({
    code: z.number().int(),
    message: z.string(),
    errors: z.array(
      z.object({
        domain: z.string(),
        reason: z.string(),
        message: z.string(),
      })
    ),
  }),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
export type GoogleSearchItem = z.infer<typeof GoogleSearchItemSchema>;
export type GoogleSearchResponse = z.infer<typeof GoogleSearchResponseSchema>;
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;
export type SearchError = z.infer<typeof SearchErrorSchema>;
