The datasets scripts are supposed to provide
- website URLs
- feed URLs
- OPML URLs

Scripts in this directory prefixed with `urls-` produce list of website/feed URLs to crawl, 
while scripts prefixed with `opml-` provide OPML URLs to parse as blogrolls. There is an
`*_all.sh` for both type which runs all scripts of each type at once.

## Provider data flow

```mermaid
flowchart TD
   subgraph opml_provider
     curated
     awesomerss
     rss-blogroll_network
   end
   opml_provider ---> opml_all
   opml_all --->|add| blogrolls

   subgraph url_provider
     from_blogrolls
     majestic
     marginalia
     wiby
     xxivv
     512k
   end
   url_provider ---> urls_all
   urls_all ---> feeds
   blogrolls ---> from_blogrolls


   subgraph crawler_index
      blogrolls
      feeds
   end
```