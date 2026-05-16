--
-- PostgreSQL database dump
--

\restrict SyQdNL9MCmpUM8dulBjYLmynVmGK6L7hVziPsA8fQWaAHmiLoGAcfbZQoPZzdZe

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: game_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_players (
    game_id text NOT NULL,
    player_id text NOT NULL,
    name text NOT NULL,
    is_ai boolean NOT NULL,
    model_name text,
    real_name text,
    survived_rounds integer NOT NULL,
    was_eliminated boolean NOT NULL
);


--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    game_id text NOT NULL,
    winner text NOT NULL,
    started_at bigint NOT NULL,
    ended_at bigint NOT NULL,
    total_rounds integer NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    message_id text NOT NULL,
    game_id text NOT NULL,
    player_id text NOT NULL,
    player_name text NOT NULL,
    text text NOT NULL,
    round integer NOT NULL,
    sent_at bigint NOT NULL
);


--
-- Name: votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.votes (
    game_id text NOT NULL,
    round integer NOT NULL,
    voter_id text NOT NULL,
    target_id text NOT NULL
);


--
-- Data for Name: game_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_players (game_id, player_id, name, is_ai, model_name, real_name, survived_rounds, was_eliminated) FROM stdin;
db9f4f9f-6e04-4140-8a85-198e7eb409f4	da6bc287-d8ac-45d4-b7c2-765e8de8dd3a	Green	f	\N	KC	3	f
db9f4f9f-6e04-4140-8a85-198e7eb409f4	4456ec28-5835-49dd-bc8d-602ecb5ca10a	Pearl	f	\N	Nathan	3	f
db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	f	\N	Brieuc	0	t
db9f4f9f-6e04-4140-8a85-198e7eb409f4	058fa0d2-ff72-47b3-822c-caccf59b6ddb	Amber	f	\N	Antoine	3	f
db9f4f9f-6e04-4140-8a85-198e7eb409f4	6af9f502-8aca-4085-a36c-dbc3e8d075cd	Ivory	t	gpt-5.4-mini	\N	2	t
db9f4f9f-6e04-4140-8a85-198e7eb409f4	00abf812-986c-4df0-bbce-56d71e5274ab	Onyx	t	gpt-5.4-mini	\N	0	t
9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	f	\N	K	1	f
9fb20734-bb5c-4b2c-9ab7-22987a2e2427	f4638768-97aa-47a5-8f24-c2423e2c7118	Coral	t	gpt-5.4-nano	\N	1	f
9fb20734-bb5c-4b2c-9ab7-22987a2e2427	35de7848-74f2-46d6-8326-b5157fea3135	Pink	t	gpt-5.5	\N	0	t
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.games (game_id, winner, started_at, ended_at, total_rounds) FROM stdin;
db9f4f9f-6e04-4140-8a85-198e7eb409f4	humans	1778938647288	1778938898351	3
9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ai	1778938983061	1778939233574	1
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (message_id, game_id, player_id, player_name, text, round, sent_at) FROM stdin;
19eb1669-3449-42c9-9b88-422d8d45bef2	db9f4f9f-6e04-4140-8a85-198e7eb409f4	4456ec28-5835-49dd-bc8d-602ecb5ca10a	Pearl	Hello	1	1778938653017
1d194072-dc97-4b1f-adc7-c9dd447299bb	db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	hello	1	1778938653132
470eb565-0974-4d32-8fd2-3536d621aa93	db9f4f9f-6e04-4140-8a85-198e7eb409f4	da6bc287-d8ac-45d4-b7c2-765e8de8dd3a	Green	Meow	1	1778938659247
f296e033-8a84-4164-bf96-4c51c6bb23c1	db9f4f9f-6e04-4140-8a85-198e7eb409f4	058fa0d2-ff72-47b3-822c-caccf59b6ddb	Amber	helllo	1	1778938659619
2788caa7-3efb-4c11-af41-6389f00a5c86	db9f4f9f-6e04-4140-8a85-198e7eb409f4	4456ec28-5835-49dd-bc8d-602ecb5ca10a	Pearl	Who want to be the mayor ?	1	1778938662336
9cdc8135-43b1-489b-abb8-891da8ee9e5d	db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	I want to be the mayor!	1	1778938668390
3a6d4185-8523-41f5-8b45-cb0cce3af38b	db9f4f9f-6e04-4140-8a85-198e7eb409f4	058fa0d2-ff72-47b3-822c-caccf59b6ddb	Amber	Pearl ?	1	1778938680280
0fd52461-bc4e-4295-b448-3526750ab0d5	db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	Please vote for me I will be good	1	1778938683339
822db29f-b377-41e1-8306-2317fda43071	db9f4f9f-6e04-4140-8a85-198e7eb409f4	da6bc287-d8ac-45d4-b7c2-765e8de8dd3a	Green	Who is the mayor?	1	1778938684327
3f7774c7-474e-4dc8-90dd-a88067db0450	db9f4f9f-6e04-4140-8a85-198e7eb409f4	058fa0d2-ff72-47b3-822c-caccf59b6ddb	Amber	qui set tu	1	1778938686996
61825a3d-e8e8-40ba-952e-05e355b8fb7a	db9f4f9f-6e04-4140-8a85-198e7eb409f4	058fa0d2-ff72-47b3-822c-caccf59b6ddb	Amber	67	1	1778938690330
845563ca-8b5f-42aa-bf15-37aa04c7b224	db9f4f9f-6e04-4140-8a85-198e7eb409f4	da6bc287-d8ac-45d4-b7c2-765e8de8dd3a	Green	67	1	1778938698554
c490a478-99e1-431f-a3e0-046ebb2b419a	db9f4f9f-6e04-4140-8a85-198e7eb409f4	00abf812-986c-4df0-bbce-56d71e5274ab	Onyx	red wants it pretty hard but that usually makes me a little suspicious tbh i’d rather go with pearl or maybe ivory	1	1778938704889
c1cb49d0-d89a-478e-9cdb-bed6ba6fc8bd	db9f4f9f-6e04-4140-8a85-198e7eb409f4	6af9f502-8aca-4085-a36c-dbc3e8d075cd	Ivory	yeah red asking that hard is a bit much lol i’m fine with pearl or maybe onyx	1	1778938707506
ec748230-ee0d-4b3e-ac29-15e68591b6cf	db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	Pearl sucks dont vote for him	1	1778938715073
0147b4ef-970a-4b6d-8f5b-4361b42fb838	db9f4f9f-6e04-4140-8a85-198e7eb409f4	4456ec28-5835-49dd-bc8d-602ecb5ca10a	Pearl	Ivory do you want to be mayor ?	1	1778938739857
6e0c5258-9680-4a1a-9a1e-e089c8f4888d	db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	fuck you onix	1	1778938783618
304ff8d2-4f60-4a7a-98e5-2565f2dcd93b	db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	i wanted to be the mayor	1	1778938789303
0dd6ef0c-ed55-4ebf-9d9a-bdde7ba8db2c	db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	no please	1	1778938806813
7cd956a2-7fb8-44ed-ae80-7c6595b5aa29	db9f4f9f-6e04-4140-8a85-198e7eb409f4	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	Red	I am sorry	1	1778938813041
7c78b07a-cd17-4274-b881-fd3f705178f7	db9f4f9f-6e04-4140-8a85-198e7eb409f4	4456ec28-5835-49dd-bc8d-602ecb5ca10a	Pearl	Onyx you are the imposter !!!!	1	1778938814434
0cd7ad51-d293-41c6-bee1-40157f119838	db9f4f9f-6e04-4140-8a85-198e7eb409f4	4456ec28-5835-49dd-bc8d-602ecb5ca10a	Pearl	Ivory can you vote please	3	1778938892532
13bfc9b6-3d12-4134-b8d6-dff4ef5fe452	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	Hello	1	1778938996163
6922b169-3f00-41ba-8c51-51af8ef0938f	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	f4638768-97aa-47a5-8f24-c2423e2c7118	Coral	hey green whatsup	1	1778939002752
ac64c172-14c6-4f06-ae74-68c7cb0b62ae	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	Who want to be a mayor?	1	1778939015680
9c839900-a508-4c80-8a03-9224b3297b77	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	Are you LLM?	1	1778939025804
6e8b6089-e41c-4856-9bdd-fd3401a91bad	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	f4638768-97aa-47a5-8f24-c2423e2c7118	Coral	nah im not a llm just playing the game whats ur read on pink rn	1	1778939030567
52e5419e-a032-42c9-9a53-9570bddf2b24	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	It say nothing it suspicious	1	1778939067194
036f8c89-b8a5-4382-b1bf-68da3d47b51f	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	f4638768-97aa-47a5-8f24-c2423e2c7118	Coral	wait what do u mean it says nothing suspicious like pink has been quiet or are u seeing some specific weird stuff	1	1778939071468
0d696999-4006-4659-8ce5-330f571a205d	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	Because he is quiet i think its LLM	1	1778939095612
5c69c0b2-041f-49fd-a918-da26b121b2ba	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	f4638768-97aa-47a5-8f24-c2423e2c7118	Coral	nah being quiet doesnt automatically mean llm to me, pinks just chill rn id rather go off actual takes	1	1778939100219
e32a63d5-57c8-4b55-b372-de2a90108821	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	he doesn't said anything in his defence	1	1778939145505
eef64d6c-2537-4f5d-9cc0-bae9b4d845b8	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	f4638768-97aa-47a5-8f24-c2423e2c7118	Coral	yeah but quiet can just mean he has nothing to add yet\nwhat did pink actually say earlier or what action did he take	1	1778939151301
6ca96326-7bd2-44ad-8c42-0990c5912153	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	f4638768-97aa-47a5-8f24-c2423e2c7118	Coral	yeah thats fair but what did he do earlier like any vote takes or reactions or is it literally just silence	1	1778939179235
b3c3c1ea-00de-449d-8ab6-8150292f371e	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	he doesn't say hello	1	1778939183470
a6a475f0-0714-4bc2-8f0d-76e2e4c996e2	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	ec619314-a3f3-4a04-a85d-17e1e7d7a903	Green	i'm sad that you don't agree with me	1	1778939208263
d180e332-c54a-4de7-ae46-0711fe0a4aaf	9fb20734-bb5c-4b2c-9ab7-22987a2e2427	f4638768-97aa-47a5-8f24-c2423e2c7118	Coral	nah dont be sad lol i jsut dont think quiet = llm\nwho did you vote for earlier and what made you lock in on pink	1	1778939213296
\.


--
-- Data for Name: votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.votes (game_id, round, voter_id, target_id) FROM stdin;
db9f4f9f-6e04-4140-8a85-198e7eb409f4	1	00abf812-986c-4df0-bbce-56d71e5274ab	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9
db9f4f9f-6e04-4140-8a85-198e7eb409f4	1	6af9f502-8aca-4085-a36c-dbc3e8d075cd	4456ec28-5835-49dd-bc8d-602ecb5ca10a
db9f4f9f-6e04-4140-8a85-198e7eb409f4	1	da6bc287-d8ac-45d4-b7c2-765e8de8dd3a	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9
db9f4f9f-6e04-4140-8a85-198e7eb409f4	1	058fa0d2-ff72-47b3-822c-caccf59b6ddb	00abf812-986c-4df0-bbce-56d71e5274ab
db9f4f9f-6e04-4140-8a85-198e7eb409f4	1	4456ec28-5835-49dd-bc8d-602ecb5ca10a	00abf812-986c-4df0-bbce-56d71e5274ab
db9f4f9f-6e04-4140-8a85-198e7eb409f4	1	7a1f4f72-93c5-4ae6-a0b8-8e6e935b06e9	00abf812-986c-4df0-bbce-56d71e5274ab
db9f4f9f-6e04-4140-8a85-198e7eb409f4	3	4456ec28-5835-49dd-bc8d-602ecb5ca10a	6af9f502-8aca-4085-a36c-dbc3e8d075cd
db9f4f9f-6e04-4140-8a85-198e7eb409f4	3	058fa0d2-ff72-47b3-822c-caccf59b6ddb	6af9f502-8aca-4085-a36c-dbc3e8d075cd
db9f4f9f-6e04-4140-8a85-198e7eb409f4	3	da6bc287-d8ac-45d4-b7c2-765e8de8dd3a	6af9f502-8aca-4085-a36c-dbc3e8d075cd
db9f4f9f-6e04-4140-8a85-198e7eb409f4	3	6af9f502-8aca-4085-a36c-dbc3e8d075cd	058fa0d2-ff72-47b3-822c-caccf59b6ddb
9fb20734-bb5c-4b2c-9ab7-22987a2e2427	1	ec619314-a3f3-4a04-a85d-17e1e7d7a903	35de7848-74f2-46d6-8326-b5157fea3135
\.


--
-- Name: game_players game_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_pkey PRIMARY KEY (game_id, player_id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (game_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (message_id);


--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (game_id, round, voter_id);


--
-- Name: game_players game_players_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(game_id);


--
-- Name: messages messages_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(game_id);


--
-- Name: votes votes_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(game_id);


--
-- PostgreSQL database dump complete
--

\unrestrict SyQdNL9MCmpUM8dulBjYLmynVmGK6L7hVziPsA8fQWaAHmiLoGAcfbZQoPZzdZe

