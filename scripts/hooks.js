module.exports = {
  preBuild: async (config) => {},
  postBuild: async (config, stats) => {},
  transformMarkdown: (content, frontmatter) => content,
  transformHTML: (html, pageContext) => html
};
