# twitterFollowerExplorer
Batch process twitter users

For every manually categorized user in the database:
- update user twitter friends (aka who they're following)
- update user twitter stats (profile, twitter stats, latest tweets)
- update user histograms for profile and tweets
- auto categorize user using current best neural network
- evaluate all best neural networks to determine current best nn
- generate global histograms: emoji, friends, hashtag, images, locations, media, places, sentiment, urls, userMentions, words
- generate maxInputHashMap
- generate bestInputsSet

The user entity histograms are used to generate neural network inputs (generateInputSet)
