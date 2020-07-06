const { ApolloServer, gql } = require('apollo-server')
// ApolloServer: 讓我們啟動 server 的 class ，不但實作許多 GraphQL 功能也提供 web application 的功能 (背後使用 express)
// gql: template literal tag, 讓你在 Javascript 中使用 GraphQL 語法
const users = [
  {id: 1, name: 'Spencer', age: 20, friendIds:[2,3], height: 175, weight: 75},
  {id: 2, name: 'Wesley', age: 25, friendIds:[1], height: 180, weight: 80},
  {id: 3, name: 'Leo', age: 30, friendIds:[2], height: 185, weight: 74}
]
const posts = [
  { id: 1, authorId: 1, title: "Hello World!", content: "This is my first post.", likeGiverIds: [2] },
  { id: 2, authorId: 2, title: "Good Night", content: "Have a Nice Dream =)", likeGiverIds: [2, 3] },
  { id: 3, authorId: 1, title: "I Love U", content: "Here's my second post!", likeGiverIds: [] },
]

// 1. GraphQL Schema 定義
const typeDefs = gql`
  """
  高度單位
  """
  enum HeightUnit {
    "公尺"
    METRE
    "公分"
    CENTIMETRE
    "英尺 (1 英尺 = 30.48 公分)"
    FOOT
  }

  """
  重量單位
  """
  enum WeightUnit {
    "公斤"
    KILOGRAM
    "公克"
    GRAM
    "磅 (1 磅 = 0.45359237 公斤)"
    POUND
  }

  type User {
    id: ID
    name: String
    age: Int
    friends: [User]
    height(unit: HeightUnit = CENTIMETRE): Float
    weight(unit: WeightUnit = KILOGRAM): Float
    posts: [Post]
  }

  type Post {
    "識別碼"
    id: ID!
    "作者"
    author: User
    "標題"
    title: String
    "內容"
    content: String
    "按讚者"
    likeGivers: [User]
  }

  type Query {
    hello: String
    me: User
    users: [User]
    user(name: String!): User
  }
  
  # type Mutation {
  #   "add post"
  #   addPost(title: String!, content: String): Post
  #   "like"
  #   likePost(postId: ID!): Post
  # }

  input AddPostInput {
    title: String!
    content: String
  }

  type Mutation {
    addPost(input: AddPostInput!): Post
  }

`
// Helper function
const findUserById = id => users.find(user => user.id === id)
const findUserByName = name => users.find(user => user.name === name)
const filterPostsByAuthorId = authorId => posts.filter(post => post.authorId === authorId)
const meId = 1
const findPostById = id => posts.find(post => post.id === id)
// 2. Resolvers 是一個會對照 Schema 中 field 的 function map ，讓你可以計算並回傳資料給 GraphQL Server
const resolvers = {
  User: {
    friends: (parent, args, context) => {
      const { friendIds } = parent
      return users.filter(user => friendIds.includes(user.id))
    },
    height: (parent, args) => {
      const { unit } = args
      // 可注意到 Enum type 進到 javascript 就變成了 String 格式
      // 另外支援 default 值 CENTIMETRE
      if (!unit || unit === "CENTIMETRE") return parent.height
      else if (unit === "METRE") return parent.height / 100
      else if (unit === "FOOT") return parent.height / 30.48
      throw new Error(`Height unit "${unit}" not supported.`)
    },
    weight: (parent, args, context) => {
      const { unit } = args
      // 支援 default 值 KILOGRAM
      if (!unit || unit === "KILOGRAM") return parent.weight
      else if (unit === "GRAM") return parent.weight * 100
      else if (unit === "POUND") return parent.weight / 0.45359237
      throw new Error(`Weight unit "${unit}" not supported.`)
    },
    posts: (parent, args, context) => {
      // parent.id 為 userId
      return filterPostsByAuthorId(parent.id)
    }
  },
  Query: {
    // 需注意名稱一定要對到 Schema 中 field 的名稱
    hello: () => 'world',
    me: () => users[0],
    users: () => users,
    user: (root, args, context) => {
      const { name } = args
      return users.find(user => user.name === name)
    }
  },
  Post: {
    // 2-1. parent 為 post 的資料，透過 post.likeGiverIds 連接到 users
    likeGivers: (parent, args, context) => {
      return parent.likeGiverIds.map(id => findUserById(id))
    },
    // 2-2. parent 為 post 的資料，透過 post.author
    author: (parent, args, context) => {
      return findUserById(parent.authorId)
    }
  },
  Mutation: {
    // addPost: (root, args, context) => {
    //   const { title, content } = args
    //    // 新增 post
    //    posts.push({
    //     id: posts.length + 1,
    //     authorId: meId,
    //     title,
    //     content,
    //     likeGivers: []
    //   });
    //   // 回傳新增的那篇 post
    //   return posts[posts.length - 1]
    // },
    // likePost: (root, args, context) => {
    //   const { postId } = args
    //   const post = findPostById(postId)
    //   if (!post) throw new Error(`Post ${psotId} Not Exists`)

    //   if (post.likeGiverIds.includes(meId)) {
    //     // 如果已經按過讚就收回
    //     const index = post.likeGiverIds.findIndex(v => v === userId)
    //     post.likeGiverIds.splice(index, 1)
    //   } else {
    //     // 否則就加入 likeGiverIds 名單
    //     post.likeGiverIds.push(meId)
    //   }
    //   return post
    // },
    // 需注意！args 打開後第一層為 input ，再進去一層才是 title, content
    addPost: (root, args, context) => {
      const { input } = args;
      const { title, content } = input;
      const newPost = {
        id: posts.length + 1,
        authorId: meId,
        title,
        content,
        likeGivers: []
      };
      posts.push(newPost);
      return newPost;
    },
  }
}

// 3. 初始化 Web Server ，需傳入 typeDefs (Schema) 與 resolvers (Resolver)
const server = new ApolloServer({
  // Schema 部分
  typeDefs,
  // Resolver 部分
  resolvers
})

// 4. 啟動 Server
server.listen().then(({ url }) => {
  console.log(`? Server ready at ${url}`)
})