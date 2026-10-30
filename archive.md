---
layout: page
title: Archive
---

{% for post in site.posts %}{% if post.hidden %}{% continue %}{% endif %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
{% endfor %}
