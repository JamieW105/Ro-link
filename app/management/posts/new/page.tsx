import PostEditor from '../PostEditor';

export default function NewPostPage() {
    return (
        <PostEditor
            submitUrl="/api/management/posts"
            submitMethod="POST"
            heading="Create Update Draft"
            subheading="Write a release note draft with structured feature sections and optional smaller follow-up notes."
            submitLabel="Save Draft"
        />
    );
}
